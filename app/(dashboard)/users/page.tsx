"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  FaCircleCheck,
  FaCircleExclamation,
  FaPenToSquare,
  FaPowerOff,
  FaShieldHalved,
  FaUserDoctor,
  FaUserGear,
  FaUserPlus,
  FaUserShield,
  FaUserTie,
  FaUsers,
  FaXmark,
} from "react-icons/fa6";
import { useRole } from "@/src/components/layout/RoleProvider";
import type { DbRole, Profile } from "@/src/lib/db/types";

type CreateUserForm = {
  email: string;
  full_name: string;
  phone: string;
  role: "super_admin" | "staff" | "doctor";
};
type EditUserForm = {
  full_name: string;
  phone: string;
  role: DbRole;
  is_active: boolean;
};
type UserManagementTab = "accounts" | "roles";
type RoleKey = "doctor" | "secretary" | "patient" | "super_admin";
type PermissionItem = {
  key: string;
  label: string;
};

const EMPTY_NEW_USER: CreateUserForm = {
  email: "",
  full_name: "",
  phone: "",
  role: "staff",
};

function profileToEditForm(user: Profile): EditUserForm {
  return {
    full_name: user.full_name,
    phone: user.phone ?? "",
    role: user.role,
    is_active: user.is_active,
  };
}

const PAGE_SIZE_OPTIONS = [10, 20, 50] as const;

// Permission catalog mirrors the clinic's current access model one-to-one.
// Keys are stable; labels are what the admin sees in the toggle UI.
const ROLE_PERMISSION_CATALOG: Record<RoleKey, PermissionItem[]> = {
  doctor: [
    { key: "appointments.manage", label: "Appointments" },
    { key: "patients.manage", label: "Patient records" },
    { key: "consultations.manage", label: "Consultations" },
    { key: "schedules.manage", label: "Schedules" },
    { key: "payments.pos", label: "Billing / POS" },
    { key: "inventory.manage", label: "Inventory" },
    { key: "inquiries.manage", label: "Inquiries" },
    { key: "faq.manage", label: "FAQ content" },
    { key: "landing.manage", label: "Website content" },
    { key: "reports.read", label: "Reports" },
    { key: "security.read", label: "Security" },
    { key: "users.manage", label: "Users" },
  ],
  secretary: [
    { key: "appointments.manage", label: "Appointments" },
    { key: "patients.manage", label: "Patient records" },
    { key: "walkins.manage", label: "Walk-in patients" },
    { key: "queue.manage", label: "Queue list" },
    { key: "billing.manage", label: "Billing" },
    { key: "payments.pos", label: "POS" },
    { key: "inventory.manage", label: "Inventory" },
    { key: "inquiries.manage", label: "Inquiries" },
    { key: "faq.manage", label: "FAQ content" },
    { key: "landing.manage", label: "Website content" },
  ],
  patient: [
    { key: "register_login", label: "Register / login" },
    { key: "book_appointment", label: "Book appointment" },
    { key: "portal.read", label: "Patient portal" },
    { key: "prescriptions.read", label: "Prescriptions" },
    { key: "consultations.read", label: "Consultation notes" },
    { key: "billing.read", label: "Billing history" },
    { key: "files.read", label: "Medical files" },
    { key: "inquiries.create", label: "Follow-up inquiries" },
  ],
  super_admin: [
    { key: "appointments.manage", label: "Appointments" },
    { key: "patients.manage", label: "Patient records" },
    { key: "consultations.manage", label: "Consultations" },
    { key: "schedules.manage", label: "Schedules" },
    { key: "payments.pos", label: "Billing / POS" },
    { key: "inventory.manage", label: "Inventory" },
    { key: "inquiries.manage", label: "Inquiries" },
    { key: "faq.manage", label: "FAQ content" },
    { key: "landing.manage", label: "Website content" },
    { key: "reports.read", label: "Reports" },
    { key: "security.read", label: "Security" },
    { key: "users.manage", label: "Users" },
    { key: "settings.manage", label: "System settings" },
  ],
};

const ROLE_DESCRIPTIONS: Record<RoleKey, string> = {
  doctor:
    "Clinical lead. Manages appointments, consultations, prescriptions, schedules, and clinic operations.",
  secretary:
    "Front-desk staff. Handles bookings, walk-in registration, queueing, billing, inventory, inquiries, and website content.",
  patient:
    "Patient account. Books visits, checks portal records, follows up, and manages personal care details.",
  super_admin:
    "System owner. Full control over the platform, role assignment, and system configuration.",
};

const DEFAULT_ROLE_PERMISSIONS: Record<RoleKey, Record<string, boolean>> =
  Object.fromEntries(
    Object.entries(ROLE_PERMISSION_CATALOG).map(([roleName, items]) => [
      roleName,
      Object.fromEntries(items.map((item) => [item.key, true])),
    ]),
  ) as Record<RoleKey, Record<string, boolean>>;

function roleLabel(role: DbRole) {
  switch (role) {
    case "super_admin":
      return "Admin";
    case "secretary":
      return "Staff";
    case "staff":
      return "Staff";
    case "doctor":
      return "Doctor";
    case "patient":
      return "Patient";
    case "admin":
      return "Admin";
    default:
      return role;
  }
}

export default function UsersPage() {
  const { role, user: sessionUser, accessToken, isLoading: authLoading } = useRole();
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [filterRole, setFilterRole] = useState<DbRole | "all">("all");
  const [filterActive, setFilterActive] = useState<"all" | "active" | "inactive">(
    "all",
  );
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingUser, setEditingUser] = useState<Profile | null>(null);
  const [editUser, setEditUser] = useState<EditUserForm>({
    full_name: "",
    phone: "",
    role: "staff",
    is_active: true,
  });
  const [activeTab, setActiveTab] = useState<UserManagementTab>("accounts");
  const [newUser, setNewUser] = useState<CreateUserForm>(EMPTY_NEW_USER);
  const [isMutating, startTransition] = useTransition();
  const [isCheckingDuplicate, setIsCheckingDuplicate] = useState(false);
  const [emailCheck, setEmailCheck] = useState<{
    status: "idle" | "checking" | "available" | "duplicate" | "error";
    message?: string;
  }>({ status: "idle" });
  const [resultDialog, setResultDialog] = useState<{
    type: "success" | "error";
    title: string;
    message: string;
    tempPassword?: string;
  } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<(typeof PAGE_SIZE_OPTIONS)[number]>(10);
  const [rolePermissions, setRolePermissions] = useState(DEFAULT_ROLE_PERMISSIONS);
  const [savedRolePermissions, setSavedRolePermissions] = useState(DEFAULT_ROLE_PERMISSIONS);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const submitLockRef = useRef(false);
  const editSubmitLockRef = useRef(false);

  const canManage = role === "SUPER_ADMIN" || role === "SECRETARY" || role === "DOCTOR";
  const currentUserId = sessionUser?.id ?? null;

  const filtered = useMemo(() => {
    let result = users;
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      result = result.filter(
        (u) =>
          u.email.toLowerCase().includes(q) || u.full_name.toLowerCase().includes(q),
      );
    }
    if (filterRole !== "all") {
      result = result.filter((u) => u.role === filterRole);
    }
    if (filterActive === "active") result = result.filter((u) => u.is_active);
    if (filterActive === "inactive") result = result.filter((u) => !u.is_active);
    return result;
  }, [filterActive, filterRole, query, users]);

  const activeUsers = users.filter((u) => u.is_active).length;
  const doctorUsers = users.filter((u) => u.role === "doctor").length;
  const secretaryUsers = users.filter((u) => u.role === "secretary" || u.role === "staff").length;
  const superAdminUsers = users.filter((u) => u.role === "super_admin").length;
  const patientUsers = users.filter((u) => u.role === "patient").length;
  const filteredCount = filtered.length;
  const totalPages = Math.max(1, Math.ceil(filteredCount / pageSize));
  const currentPageSafe = Math.min(currentPage, totalPages);
  const pageStart = filteredCount === 0 ? 0 : (currentPageSafe - 1) * pageSize + 1;
  const pageEnd = Math.min(currentPageSafe * pageSize, filteredCount);
  const paginatedUsers = useMemo(() => {
    const start = (currentPageSafe - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, currentPageSafe, pageSize]);
  const rolesDirty = useMemo(
    () => JSON.stringify(rolePermissions) !== JSON.stringify(savedRolePermissions),
    [rolePermissions, savedRolePermissions],
  );
  const allVisibleSelected =
    paginatedUsers.length > 0 &&
    paginatedUsers.every((userItem) => selectedUserIds.includes(userItem.id));

  useEffect(() => {
    setCurrentPage(1);
  }, [query, filterRole, filterActive, pageSize]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  useEffect(() => {
    if (authLoading) return;
    if (!accessToken) {
      setRolePermissions(DEFAULT_ROLE_PERMISSIONS);
      setSavedRolePermissions(DEFAULT_ROLE_PERMISSIONS);
      return;
    }
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/v2/role-permissions", {
          cache: "no-store",
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!res.ok) return;
        const payload = (await res.json()) as {
          rolePermissions?: Record<RoleKey, Record<string, boolean>>;
        };
        const merged = {
          ...DEFAULT_ROLE_PERMISSIONS,
          ...(payload.rolePermissions ?? {}),
        };
        if (active) {
          setRolePermissions(merged);
          setSavedRolePermissions(merged);
        }
      } catch {
        // Keep defaults when endpoint is unavailable.
      }
    })();
    return () => {
      active = false;
    };
  }, [accessToken, authLoading]);

  useEffect(() => {
    if (authLoading || !accessToken) return;
    let active = true;
    (async () => {
      try {
        setLoading(true);
        const res = await fetch("/api/v2/users", {
          cache: "no-store",
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { message?: string };
          throw new Error(body.message ?? "Failed to load users");
        }
        const payload = (await res.json()) as { users: Profile[] };
        if (active) setUsers(payload.users ?? []);
      } catch (e) {
        if (active) {
          setFeedback({
            type: "error",
            message: e instanceof Error ? e.message : "Failed to load users",
          });
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [accessToken, authLoading]);

  useEffect(() => {
    setSelectedUserIds([]);
  }, [currentPageSafe, filterActive, filterRole, query, pageSize]);

  function closeModal() {
    setShowAddModal(false);
    setNewUser(EMPTY_NEW_USER);
    setEmailCheck({ status: "idle" });
  }

  function closeEditModal() {
    setShowEditModal(false);
    setEditingUser(null);
    setEditUser({
      full_name: "",
      phone: "",
      role: "staff",
      is_active: true,
    });
  }

  function openEditModal(user: Profile) {
    setFeedback(null);
    setEditingUser(user);
    setEditUser(profileToEditForm(user));
    setShowEditModal(true);
  }

  async function patchUser(userId: string, body: Record<string, unknown>) {
    const res = await fetch(`/api/v2/users/${userId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { message?: string };
      throw new Error(err.message ?? "Unable to update user");
    }
    return (await res.json()) as { user: Profile };
  }

  function submitEditUser(event: React.FormEvent) {
    event.preventDefault();
    if (!accessToken || !editingUser || editSubmitLockRef.current || isMutating) return;
    editSubmitLockRef.current = true;
    setFeedback(null);

    startTransition(async () => {
      try {
        const before = profileToEditForm(editingUser);
        const payload: Record<string, unknown> = {};
        if (editUser.full_name.trim() !== before.full_name.trim()) {
          payload.full_name = editUser.full_name.trim();
        }
        const nextPhone = editUser.phone.trim() || null;
        const prevPhone = before.phone.trim() || null;
        if (nextPhone !== prevPhone) {
          payload.phone = nextPhone;
        }
        if (editUser.role !== before.role) {
          payload.role = editUser.role;
        }
        if (editUser.is_active !== before.is_active) {
          if (currentUserId === editingUser.id && editUser.is_active === false) {
            setEditUser((p) => ({ ...p, is_active: true }));
          } else {
            payload.is_active = editUser.is_active;
          }
        }

        if (currentUserId === editingUser.id && payload.is_active === false) {
          throw new Error("You cannot deactivate your own account.");
        }

        if (Object.keys(payload).length === 0) {
          setFeedback({ type: "success", message: "No changes to save." });
          closeEditModal();
          return;
        }

        const { user: updated } = await patchUser(editingUser.id, payload);
        setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
        setFeedback({ type: "success", message: "User updated successfully." });
        setResultDialog({
          type: "success",
          title: "User updated",
          message: `${updated.full_name}'s profile was saved.`,
        });
        closeEditModal();
      } catch (e) {
        const message = e instanceof Error ? e.message : "Unable to update user.";
        setFeedback({ type: "error", message });
        setResultDialog({
          type: "error",
          title: "Unable to update user",
          message,
        });
      } finally {
        editSubmitLockRef.current = false;
      }
    });
  }

  function exportSelectedUsersCsv() {
    const rows = users.filter((u) => selectedUserIds.includes(u.id));
    if (rows.length === 0) return;
    const header = ["id", "full_name", "email", "phone", "role", "is_active", "created_at"];
    const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const lines = [
      header.join(","),
      ...rows.map((u) =>
        [
          u.id,
          u.full_name,
          u.email,
          u.phone ?? "",
          u.role,
          u.is_active ? "true" : "false",
          u.created_at,
        ]
          .map((cell) => escape(String(cell)))
          .join(","),
      ),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `users-export-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setFeedback({ type: "success", message: `Exported ${rows.length} user(s).` });
  }

  function bulkSetActive(targetActive: boolean) {
    if (!accessToken || selectedUserIds.length === 0) return;
    setFeedback(null);
    startTransition(async () => {
      const ids = [...selectedUserIds];
      const skippedSelf =
        targetActive === false && currentUserId ? ids.filter((id) => id === currentUserId) : [];
      const toPatch = ids.filter((id) => !(targetActive === false && id === currentUserId));
      let okCount = 0;
      const errors: string[] = [];
      for (const id of toPatch) {
        const user = users.find((u) => u.id === id);
        if (!user || user.is_active === targetActive) continue;
        try {
          const { user: updated } = await patchUser(id, { is_active: targetActive });
          setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
          okCount += 1;
        } catch (e) {
          errors.push(e instanceof Error ? e.message : "Update failed");
        }
      }
      setSelectedUserIds([]);
      const parts = [`Updated ${okCount} user(s).`];
      if (skippedSelf.length) {
        parts.push("Skipped your own account (cannot deactivate yourself).");
      }
      if (errors.length) {
        parts.push(`${errors.length} error(s): ${errors.slice(0, 2).join("; ")}`);
      }
      setFeedback({
        type: errors.length ? "error" : "success",
        message: parts.join(" "),
      });
    });
  }

  async function checkEmailDuplicate(rawEmail: string) {
    if (!accessToken) {
      return { duplicate: false, normalizedEmail: rawEmail.trim().toLowerCase() };
    }
    const normalizedEmail = rawEmail.trim().toLowerCase();
    if (!normalizedEmail) {
      return { duplicate: false, normalizedEmail };
    }

    const existingUserRes = await fetch("/api/v2/users", {
      cache: "no-store",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!existingUserRes.ok) {
      const err = (await existingUserRes.json().catch(() => ({}))) as { message?: string };
      throw new Error(err.message ?? "Unable to validate user email.");
    }
    const existingPayload = (await existingUserRes.json()) as { users: Profile[] };
    const duplicate = (existingPayload.users ?? []).some(
      (userItem) => userItem.email.toLowerCase() === normalizedEmail,
    );
    return { duplicate, normalizedEmail };
  }

  async function validateEmailAvailability(email: string) {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      setEmailCheck({ status: "idle" });
      return false;
    }

    setEmailCheck({ status: "checking", message: "Checking if email already exists..." });
    try {
      const { duplicate } = await checkEmailDuplicate(email);
      if (duplicate) {
        setEmailCheck({
          status: "duplicate",
          message: "This email is already registered. Use a different email.",
        });
        return false;
      }
      setEmailCheck({ status: "available", message: "Email is available." });
      return true;
    } catch (e) {
      setEmailCheck({
        status: "error",
        message: e instanceof Error ? e.message : "Unable to validate email.",
      });
      return false;
    }
  }

  function submitNewUser(event: React.FormEvent) {
    event.preventDefault();
    if (!accessToken || submitLockRef.current || isMutating || isCheckingDuplicate) return;
    setFeedback(null);
    submitLockRef.current = true;

    startTransition(async () => {
      try {
        const normalizedEmail = newUser.email.trim().toLowerCase();
        if (!normalizedEmail) {
          throw new Error("Email is required.");
        }

        setIsCheckingDuplicate(true);
        const { duplicate: alreadyExists } = await checkEmailDuplicate(newUser.email);
        if (alreadyExists) {
          setEmailCheck({
            status: "duplicate",
            message: "This email is already registered. Use a different email.",
          });
          throw new Error("This email is already registered. Use a different email.");
        }
        setEmailCheck({ status: "available", message: "Email is available." });

        const body = {
          email: normalizedEmail,
          full_name: newUser.full_name.trim(),
          phone: newUser.phone.trim() || null,
          role: newUser.role,
        };

        const res = await fetch("/api/v2/users", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify(body),
        });

        if (!res.ok) {
          const err = (await res.json().catch(() => ({}))) as { message?: string };
          throw new Error(err.message ?? "Unable to create user.");
        }

        const created = (await res.json()) as { user_id: string; temp_password: string };
        setFeedback({
          type: "success",
          message: "User created. Copy the temporary password and share it securely.",
        });
        setResultDialog({
          type: "success",
          title: "User created successfully",
          message: "The account is ready. Share the temporary password securely.",
          tempPassword: created.temp_password,
        });
        closeModal();

        // Refresh list
        const reload = await fetch("/api/v2/users", {
          cache: "no-store",
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        const payload = (await reload.json()) as { users: Profile[] };
        setUsers(payload.users ?? []);
      } catch (e) {
        const message = e instanceof Error ? e.message : "Unable to create user.";
        setFeedback({
          type: "error",
          message,
        });
        setResultDialog({
          type: "error",
          title: "Unable to create user",
          message,
        });
      } finally {
        submitLockRef.current = false;
        setIsCheckingDuplicate(false);
      }
    });
  }

  function toggleActive(user: Profile) {
    if (!accessToken) return;
    setFeedback(null);
    startTransition(async () => {
      try {
        const { user: updated } = await patchUser(user.id, { is_active: !user.is_active });
        setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
      } catch (e) {
        setFeedback({
          type: "error",
          message: e instanceof Error ? e.message : "Unable to update user",
        });
      }
    });
  }

  function setPermission(roleKey: RoleKey, permissionKey: string, enabled: boolean) {
    setRolePermissions((prev) => ({
      ...prev,
      [roleKey]: {
        ...prev[roleKey],
        [permissionKey]: enabled,
      },
    }));
  }

  function toggleUserSelection(userId: string) {
    setSelectedUserIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId],
    );
  }

  function toggleSelectAllVisible() {
    if (allVisibleSelected) {
      setSelectedUserIds((prev) =>
        prev.filter((id) => !paginatedUsers.some((userItem) => userItem.id === id)),
      );
      return;
    }
    setSelectedUserIds((prev) => [
      ...new Set([...prev, ...paginatedUsers.map((userItem) => userItem.id)]),
    ]);
  }

  function resetRolePermissions() {
    setRolePermissions(DEFAULT_ROLE_PERMISSIONS);
  }

  function saveRolePermissions() {
    if (!accessToken) return;
    startTransition(async () => {
      try {
        const res = await fetch("/api/v2/role-permissions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ rolePermissions }),
        });
        if (!res.ok) {
          const err = (await res.json().catch(() => ({}))) as { message?: string };
          throw new Error(err.message ?? "Failed to save role permissions.");
        }
        const payload = (await res.json()) as {
          rolePermissions: Record<RoleKey, Record<string, boolean>>;
        };
        setRolePermissions(payload.rolePermissions);
        setSavedRolePermissions(payload.rolePermissions);
        setFeedback({
          type: "success",
          message: "Roles and permissions saved successfully.",
        });
        setResultDialog({
          type: "success",
          title: "Permissions updated",
          message: "Role permissions have been saved.",
        });
      } catch (e) {
        setFeedback({
          type: "error",
          message: e instanceof Error ? e.message : "Failed to save role permissions.",
        });
      }
    });
  }

  if (!canManage) {
    return (
      <div className="rounded-xl border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-700">
        Forbidden. Only Admin and Doctor can manage users.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Toolbar header — same compact style as the POS terminal so the dashboard reads as one tool, not many. */}
      <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-yellow-400 text-white">
            <FaUsers className="h-4 w-4" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-base font-bold leading-tight text-slate-900">Users Management</h1>
            <p className="text-xs text-slate-500">
              Accounts, roles, and access permissions for the whole clinic.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Tab pill toggle — tighter than the previous tab bar. */}
          <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
            <button
              type="button"
              onClick={() => setActiveTab("accounts")}
              className={`rounded-md px-3 py-1.5 text-xs font-bold transition ${
                  activeTab === "accounts"
                    ? "bg-white text-yellow-700 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
            >
              Accounts
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("roles")}
              className={`rounded-md px-3 py-1.5 text-xs font-bold transition ${
                  activeTab === "roles"
                    ? "bg-white text-yellow-700 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
            >
              Roles & Permissions
            </button>
          </div>

          {activeTab === "accounts" ? (
            <button
              type="button"
              onClick={() => {
                setFeedback(null);
                setShowAddModal(true);
              }}
              className="inline-flex items-center gap-1.5 rounded-lg bg-yellow-400 px-3 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-yellow-400"
            >
              <FaUserPlus className="h-3 w-3" aria-hidden="true" />
              Add User
            </button>
          ) : null}
        </div>
      </header>

      {feedback ? (
        <div
          className={`flex items-start gap-2.5 rounded-xl border px-4 py-3 text-sm ${
            feedback.type === "success"
              ? "border-yellow-200 bg-yellow-50 text-yellow-700"
              : "border-yellow-200 bg-yellow-50 text-yellow-800"
          }`}
        >
          {feedback.type === "success" ? (
            <FaCircleCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          ) : (
            <FaCircleExclamation className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          )}
          <span>{feedback.message}</span>
        </div>
      ) : null}

      {activeTab === "accounts" ? (
        <>
      {/* Compact stat strip — single row, monospace numbers, one accent color. */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <StatTile label="Active" value={activeUsers} icon={<FaUsers className="h-3 w-3" />} />
        <StatTile label="Doctors" value={doctorUsers} icon={<FaUserDoctor className="h-3 w-3" />} />
        <StatTile label="Staff" value={secretaryUsers} icon={<FaUserTie className="h-3 w-3" />} />
        <StatTile label="Admins" value={superAdminUsers} icon={<FaUserShield className="h-3 w-3" />} />
        <StatTile label="Patients" value={patientUsers} icon={<FaUserGear className="h-3 w-3" />} />
      </div>

      {/* Filter + bulk-action toolbar — one row on desktop, wraps on mobile. */}
      <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex flex-1 min-w-[200px] flex-col gap-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Search</span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Email or name…"
              className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs outline-none transition focus:border-yellow-300 focus:ring-1 focus:ring-yellow-200"
            />
          </label>
          <label className="flex w-full flex-col gap-1 sm:w-40">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Role</span>
            <select
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value as DbRole | "all")}
              className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs outline-none transition focus:border-yellow-300 focus:ring-1 focus:ring-yellow-200"
            >
              <option value="all">All roles</option>
              <option value="super_admin">Admin</option>
              <option value="doctor">Doctor</option>
              <option value="staff">Staff</option>
              <option value="secretary">Secretary (legacy)</option>
              <option value="patient">Patient</option>
            </select>
          </label>
          <label className="flex w-full flex-col gap-1 sm:w-32">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Status</span>
            <select
              value={filterActive}
              onChange={(e) => setFilterActive(e.target.value as typeof filterActive)}
              className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs outline-none transition focus:border-yellow-300 focus:ring-1 focus:ring-yellow-200"
            >
              <option value="all">All</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </label>
          <label className="flex w-full flex-col gap-1 sm:w-24">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Per page</span>
            <select
              value={pageSize}
              onChange={(e) =>
                setPageSize(Number(e.target.value) as (typeof PAGE_SIZE_OPTIONS)[number])
              }
              className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs outline-none transition focus:border-yellow-300 focus:ring-1 focus:ring-yellow-200"
            >
              {PAGE_SIZE_OPTIONS.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setFilterRole("all");
              setFilterActive("all");
            }}
            className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Reset
          </button>
        </div>

        {/* Bulk action strip — only visible when one or more rows are selected. */}
        {selectedUserIds.length > 0 ? (
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-yellow-200 bg-yellow-50/60 px-3 py-2">
            <span className="text-xs font-bold text-yellow-700">
              {selectedUserIds.length} selected
            </span>
            <span className="text-slate-300">·</span>
            <button
              type="button"
              disabled={isMutating}
              onClick={() => bulkSetActive(true)}
              className="rounded-md border border-yellow-300 bg-white px-2.5 py-1 text-xs font-semibold text-yellow-700 transition hover:bg-yellow-100 disabled:opacity-50"
            >
              Activate
            </button>
            <button
              type="button"
              disabled={isMutating}
              onClick={() => bulkSetActive(false)}
              className="rounded-md border border-yellow-300 bg-white px-2.5 py-1 text-xs font-semibold text-yellow-700 transition hover:bg-yellow-50 disabled:opacity-50"
            >
              Deactivate
            </button>
            <button
              type="button"
              onClick={exportSelectedUsersCsv}
              className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Export CSV
            </button>
            <button
              type="button"
              onClick={() => setSelectedUserIds([])}
              className="ml-auto rounded-md px-2 py-1 text-xs text-slate-500 hover:text-slate-800"
            >
              Clear
            </button>
          </div>
        ) : null}

        <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
          <span>{loading ? "Loading…" : `${filtered.length} of ${users.length} user(s)`}</span>
        </div>
      </div>

      {/* Mobile card view — same data as the desktop table, stacked. */}
      <div className="space-y-2 md:hidden">
        {!loading && paginatedUsers.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-8 text-center text-xs text-slate-400 shadow-sm">
            No users match these filters.
          </div>
        ) : null}
        {paginatedUsers.map((u) => (
          <div key={u.id} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
            <div className="flex items-start justify-between gap-2">
              <label className="pt-0.5">
                <input
                  type="checkbox"
                  checked={selectedUserIds.includes(u.id)}
                  onChange={() => toggleUserSelection(u.id)}
                  className="h-3.5 w-3.5 rounded border-slate-300 text-amber-400 focus:ring-amber-300"
                  aria-label={`Select ${u.full_name}`}
                />
              </label>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-slate-900">{u.full_name}</p>
                <p className="mt-0.5 truncate text-xs text-slate-600">{u.email}</p>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  <RolePill role={u.role} />
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                      u.is_active ? "bg-yellow-100 text-yellow-700" : "bg-slate-200 text-slate-600"
                    }`}
                  >
                    {u.is_active ? "Active" : "Inactive"}
                  </span>
                </div>
                {u.phone ? (
                  <p className="mt-1 font-mono text-[11px] text-slate-500">{u.phone}</p>
                ) : null}
              </div>
              <div className="flex shrink-0 flex-col gap-1">
                <button
                  type="button"
                  disabled={isMutating}
                  onClick={() => openEditModal(u)}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-700 transition hover:border-yellow-300 hover:bg-yellow-50 disabled:cursor-not-allowed disabled:opacity-60"
                  aria-label={`Edit ${u.full_name}`}
                  title="Edit"
                >
                  <FaPenToSquare className="h-3 w-3" />
                </button>
                <button
                  type="button"
                  disabled={isMutating}
                  onClick={() => toggleActive(u)}
                  className={`inline-flex h-7 w-7 items-center justify-center rounded-md border transition disabled:cursor-not-allowed disabled:opacity-60 ${
                    u.is_active
                      ? "border-yellow-200 text-yellow-700 hover:bg-yellow-50"
                      : "border-yellow-200 text-yellow-700 hover:bg-yellow-50"
                  }`}
                  aria-label={`${u.is_active ? "Deactivate" : "Activate"} ${u.full_name}`}
                  title={u.is_active ? "Deactivate" : "Activate"}
                >
                  <FaPowerOff className="h-3 w-3" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop table — tighter cells, monospace UID, classic admin-tool density. */}
      <div className="hidden overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm md:block">
        <table className="w-full text-left">
          <thead className="border-b border-slate-200 bg-slate-50">
            <tr className="text-[10px] font-bold uppercase tracking-wider text-slate-600">
              <th className="px-3 py-2">
                <input
                  type="checkbox"
                  checked={allVisibleSelected}
                  onChange={toggleSelectAllVisible}
                  className="h-3.5 w-3.5 rounded border-slate-300 text-amber-400 focus:ring-amber-300"
                  aria-label="Select all visible users"
                />
              </th>
              <th className="px-3 py-2">User</th>
              <th className="px-3 py-2">Email</th>
              <th className="px-3 py-2">Phone</th>
              <th className="px-3 py-2">Role</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Registered</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {!loading && paginatedUsers.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-10 text-center text-xs text-slate-400">
                  No users match these filters.
                </td>
              </tr>
            ) : null}
            {paginatedUsers.map((u) => (
              <tr
                key={u.id}
                className="border-t border-slate-100 text-xs text-slate-700 transition hover:bg-yellow-50/40"
              >
                <td className="px-3 py-2 align-middle">
                  <input
                    type="checkbox"
                    checked={selectedUserIds.includes(u.id)}
                    onChange={() => toggleUserSelection(u.id)}
                    className="h-3.5 w-3.5 rounded border-slate-300 text-amber-400 focus:ring-amber-300"
                    aria-label={`Select ${u.full_name}`}
                  />
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-yellow-400 text-[10px] font-bold text-white">
                      {u.full_name
                        .split(" ")
                        .filter(Boolean)
                        .slice(0, 2)
                        .map((part) => part[0]?.toUpperCase() ?? "")
                        .join("") || "U"}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900">{u.full_name}</p>
                      <p className="truncate font-mono text-[10px] text-slate-400">{u.id.slice(0, 8)}</p>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-2 text-slate-700">{u.email}</td>
                <td className="px-3 py-2 font-mono text-[11px] text-slate-700">{u.phone ?? "—"}</td>
                <td className="px-3 py-2">
                  <RolePill role={u.role} />
                </td>
                <td className="px-3 py-2">
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                      u.is_active
                        ? "bg-yellow-100 text-yellow-700"
                        : "bg-slate-200 text-slate-600"
                    }`}
                  >
                    {u.is_active ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="px-3 py-2 text-[11px] text-slate-500">
                  {new Date(u.created_at).toLocaleDateString(undefined, {
                    year: "2-digit",
                    month: "short",
                    day: "numeric",
                  })}
                </td>
                <td className="px-3 py-2">
                  <div className="flex justify-end gap-1">
                    <button
                      type="button"
                      disabled={isMutating}
                      onClick={() => openEditModal(u)}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-700 transition hover:border-yellow-300 hover:bg-yellow-50 hover:text-yellow-700 disabled:cursor-not-allowed disabled:opacity-60"
                      aria-label={`Edit ${u.full_name}`}
                      title="Edit"
                    >
                      <FaPenToSquare className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      disabled={isMutating}
                      onClick={() => toggleActive(u)}
                      className={`inline-flex h-7 w-7 items-center justify-center rounded-md border transition disabled:cursor-not-allowed disabled:opacity-60 ${
                        u.is_active
                          ? "border-yellow-200 text-yellow-700 hover:bg-yellow-50"
                          : "border-yellow-200 text-yellow-700 hover:bg-yellow-50"
                      }`}
                      aria-label={`${u.is_active ? "Deactivate" : "Activate"} ${u.full_name}`}
                      title={u.is_active ? "Deactivate" : "Activate"}
                    >
                      <FaPowerOff className="h-3 w-3" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination — tighter, monospace page numbers. */}
      <div className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <p className="text-slate-600">
          {loading
            ? "Loading…"
            : filteredCount === 0
              ? "No users to display"
              : `Showing ${pageStart}–${pageEnd} of ${filteredCount}`}
        </p>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPageSafe === 1 || loading}
            className="rounded-md border border-slate-200 px-2 py-1 font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            ← Prev
          </button>
          <span className="rounded-md bg-slate-100 px-2 py-1 font-mono font-bold text-slate-700">
            {currentPageSafe} / {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPageSafe >= totalPages || loading}
            className="rounded-md border border-slate-200 px-2 py-1 font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Next →
          </button>
        </div>
      </div>
      </>
      ) : null}

      {activeTab === "roles" ? (
        <div className="space-y-3">
          {/* Save bar — sticky at the top of the tab so the cashier never loses sight of "your changes haven't been saved yet". */}
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
            <div className="flex items-center gap-2">
              <FaShieldHalved className="h-4 w-4 text-yellow-700" aria-hidden="true" />
              <div>
                <p className="text-xs font-bold text-slate-900">Roles &amp; Permissions Matrix</p>
                <p className="text-[11px] text-slate-500">
                  Toggle access per role · {rolesDirty ? "unsaved changes" : "all saved"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={resetRolePermissions}
                className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Reset defaults
              </button>
              <button
                type="button"
                onClick={saveRolePermissions}
                disabled={!rolesDirty || isMutating}
                className="inline-flex items-center gap-1.5 rounded-md bg-yellow-400 px-3 py-1.5 text-xs font-bold text-white shadow-sm transition hover:bg-yellow-400 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500"
              >
                <FaCircleCheck className="h-3 w-3" aria-hidden="true" />
                {isMutating ? "Saving…" : "Save Permissions"}
              </button>
            </div>
          </div>

          {/* Role cards — one per role, each acting as both reference (description + headcount) and permission editor. */}
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {(
              [
                {
                  key: "doctor",
                  title: "Doctor",
                  icon: FaUserDoctor,
                  count: doctorUsers,
                  accent: "border-yellow-200 bg-yellow-50/40",
                  badge: "bg-yellow-100 text-yellow-700",
                  iconBg: "bg-yellow-400",
                },
                {
                  key: "secretary",
                  title: "Staff",
                  icon: FaUserTie,
                  count: secretaryUsers,
                  accent: "border-yellow-200 bg-yellow-50/40",
                  badge: "bg-yellow-100 text-yellow-700",
                  iconBg: "bg-yellow-400",
                },
                {
                  key: "patient",
                  title: "Patient",
                  icon: FaUserGear,
                  count: patientUsers,
                  accent: "border-yellow-200 bg-yellow-50/40",
                  badge: "bg-yellow-100 text-yellow-700",
                  iconBg: "bg-yellow-300",
                },
                {
                  key: "super_admin",
                  title: "Admin",
                  icon: FaUserShield,
                  count: superAdminUsers,
                  accent: "border-yellow-200 bg-yellow-50/40",
                  badge: "bg-yellow-100 text-yellow-700",
                  iconBg: "bg-yellow-400",
                },
              ] as const
            ).map((cfg) => {
              const Icon = cfg.icon;
              return (
                <div key={cfg.key} className={`rounded-xl border ${cfg.accent} p-4 shadow-sm`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className={`flex h-9 w-9 items-center justify-center rounded-lg text-white ${cfg.iconBg}`}>
                        <Icon className="h-4 w-4" aria-hidden="true" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-slate-900">{cfg.title}</h3>
                        <p className="mt-0.5 text-[11px] leading-snug text-slate-600">
                          {ROLE_DESCRIPTIONS[cfg.key]}
                        </p>
                      </div>
                    </div>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 font-mono text-[10px] font-bold ${cfg.badge}`}>
                      {cfg.count} user{cfg.count === 1 ? "" : "s"}
                    </span>
                  </div>

                  <div className="mt-3 space-y-1 border-t border-slate-200/70 pt-3">
                    {ROLE_PERMISSION_CATALOG[cfg.key].map((permission) => {
                      const enabled = Boolean(rolePermissions[cfg.key][permission.key]);
                      return (
                        <label
                          key={permission.key}
                          className={`flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-xs transition ${
                            enabled
                              ? "bg-white text-slate-900 shadow-sm"
                              : "text-slate-500 hover:bg-white/50"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={enabled}
                            onChange={(e) => setPermission(cfg.key, permission.key, e.target.checked)}
                            className="h-3.5 w-3.5 rounded border-slate-300 text-amber-400 focus:ring-amber-300"
                          />
                          <span className={enabled ? "font-semibold" : ""}>{permission.label}</span>
                          {enabled ? (
                            <FaCircleCheck className="ml-auto h-3 w-3 shrink-0 text-amber-400" aria-hidden="true" />
                          ) : null}
                        </label>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {showAddModal ? (
        <ModalShell title="Add new user" tone="emerald" onClose={closeModal}>
          <form onSubmit={submitNewUser} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Full name" required>
                <input
                  value={newUser.full_name}
                  onChange={(e) => setNewUser((p) => ({ ...p, full_name: e.target.value }))}
                  className={INPUT_CLASS}
                  placeholder="e.g. Esteban James"
                  required
                />
              </Field>
              <Field
                label="Email"
                required
                hint={
                  emailCheck.status === "available"
                    ? "✓ Email is available."
                    : emailCheck.status === "checking"
                      ? "Checking…"
                      : emailCheck.status === "duplicate"
                        ? emailCheck.message ?? "Already registered."
                        : emailCheck.status === "error"
                          ? emailCheck.message ?? "Could not validate email."
                          : "Validated on blur to prevent duplicates."
                }
                hintTone={
                  emailCheck.status === "available"
                    ? "success"
                    : emailCheck.status === "duplicate" || emailCheck.status === "error"
                      ? "error"
                      : "muted"
                }
              >
                <input
                  type="email"
                  value={newUser.email}
                  onChange={(e) => {
                    setNewUser((p) => ({ ...p, email: e.target.value }));
                    setEmailCheck({ status: "idle" });
                  }}
                  onBlur={() => {
                    void validateEmailAvailability(newUser.email);
                  }}
                  className={INPUT_CLASS}
                  placeholder="name@email.com"
                  required
                />
              </Field>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Phone (optional)">
                <input
                  value={newUser.phone}
                  onChange={(e) => setNewUser((p) => ({ ...p, phone: e.target.value }))}
                  className={INPUT_CLASS}
                  placeholder="+63 9XX XXX XXXX"
                />
              </Field>
              <Field label="Role" required>
                <select
                  value={newUser.role}
                  onChange={(e) =>
                    setNewUser((p) => ({
                      ...p,
                      role: e.target.value as CreateUserForm["role"],
                    }))
                  }
                  className={INPUT_CLASS}
                >
                  <option value="staff">Staff</option>
                  <option value="doctor" disabled={doctorUsers > 0}>
                    Doctor{doctorUsers > 0 ? " (already assigned)" : ""}
                  </option>
                  <option value="super_admin">Admin</option>
                </select>
              </Field>
            </div>

            {doctorUsers > 0 ? (
              <p className="rounded-md border border-yellow-200 bg-yellow-50 px-3 py-2 text-[11px] text-yellow-700">
                This clinic is configured for one doctor only: Doctora Kulot, MD.
              </p>
            ) : null}

            <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-600">
              The new user will receive a temporary password to share securely. Patient accounts self-register from the public site.
            </p>

            <div className="flex justify-end gap-2 border-t border-slate-200 pt-3">
              <button
                type="button"
                onClick={closeModal}
                className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isMutating || isCheckingDuplicate || emailCheck.status === "duplicate"}
                className="inline-flex items-center gap-1.5 rounded-md bg-yellow-400 px-3 py-1.5 text-xs font-bold text-white shadow-sm transition hover:bg-yellow-400 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500"
              >
                <FaUserPlus className="h-3 w-3" aria-hidden="true" />
                {isCheckingDuplicate ? "Checking email…" : isMutating ? "Creating…" : "Create User"}
              </button>
            </div>
          </form>
        </ModalShell>
      ) : null}

      {showEditModal && editingUser ? (
        <ModalShell title={`Edit · ${editingUser.full_name}`} tone="emerald" onClose={closeEditModal}>
          <p className="mb-3 rounded-md bg-slate-50 px-2.5 py-1.5 text-[11px] text-slate-600">
            <span className="font-semibold text-slate-800">Email:</span> {editingUser.email}
            <span className="ml-2 text-slate-400">· Email cannot be changed.</span>
          </p>
          <form onSubmit={submitEditUser} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Full name" required>
                <input
                  value={editUser.full_name}
                  onChange={(e) => setEditUser((p) => ({ ...p, full_name: e.target.value }))}
                  className={INPUT_CLASS}
                  required
                />
              </Field>
              <Field label="Phone">
                <input
                  value={editUser.phone}
                  onChange={(e) => setEditUser((p) => ({ ...p, phone: e.target.value }))}
                  className={INPUT_CLASS}
                  placeholder="+63 9XX XXX XXXX"
                />
              </Field>
            </div>
            <Field label="Role">
              <select
                value={editUser.role}
                onChange={(e) =>
                  setEditUser((p) => ({ ...p, role: e.target.value as DbRole }))
                }
                className={INPUT_CLASS}
              >
                <option value="super_admin">Admin</option>
                <option value="doctor" disabled={doctorUsers > 0 && editingUser.role !== "doctor"}>
                  Doctor{doctorUsers > 0 && editingUser.role !== "doctor" ? " (already assigned)" : ""}
                </option>
                <option value="staff">Staff</option>
                <option value="secretary">Secretary (legacy)</option>
                <option value="patient">Patient</option>
              </select>
            </Field>
            <label className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
              <input
                type="checkbox"
                checked={editUser.is_active}
                onChange={(e) => setEditUser((p) => ({ ...p, is_active: e.target.checked }))}
                className="h-3.5 w-3.5 rounded border-slate-300 text-amber-400 focus:ring-amber-300"
              />
              Account active
            </label>
            {currentUserId === editingUser.id && !editUser.is_active ? (
              <p className="text-[11px] font-semibold text-yellow-700">
                You can&apos;t deactivate your own account. The toggle is ignored on save.
              </p>
            ) : null}
            <div className="flex justify-end gap-2 border-t border-slate-200 pt-3">
              <button
                type="button"
                onClick={closeEditModal}
                className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isMutating}
                className="inline-flex items-center gap-1.5 rounded-md bg-yellow-400 px-3 py-1.5 text-xs font-bold text-white shadow-sm transition hover:bg-yellow-400 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500"
              >
                <FaCircleCheck className="h-3 w-3" aria-hidden="true" />
                {isMutating ? "Saving…" : "Save Changes"}
              </button>
            </div>
          </form>
        </ModalShell>
      ) : null}

      {resultDialog ? (
        <ModalShell
          title={resultDialog.title}
          tone={resultDialog.type === "success" ? "emerald" : "red"}
          onClose={() => setResultDialog(null)}
          maxWidth="md"
        >
          <p className="text-xs text-slate-600">{resultDialog.message}</p>
          {resultDialog.tempPassword ? (
            <div className="mt-3 rounded-md border border-yellow-200 bg-yellow-50 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-yellow-800">Temporary password</p>
              <p className="mt-1 break-all font-mono text-sm font-bold text-amber-950">
                {resultDialog.tempPassword}
              </p>
            </div>
          ) : null}
          <div className="mt-3 flex justify-end gap-2 border-t border-slate-200 pt-3">
            {resultDialog.tempPassword ? (
              <button
                type="button"
                onClick={async () => {
                  await navigator.clipboard.writeText(resultDialog.tempPassword ?? "");
                  setFeedback({
                    type: "success",
                    message: "Temporary password copied to clipboard.",
                  });
                }}
                className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Copy password
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => setResultDialog(null)}
              className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-bold text-white hover:bg-slate-800"
            >
              Close
            </button>
          </div>
        </ModalShell>
      ) : null}
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const INPUT_CLASS =
  "w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs outline-none transition focus:border-yellow-300 focus:ring-1 focus:ring-yellow-200";

function StatTile({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</p>
        <p className="font-mono text-xl font-black tabular-nums text-slate-900">{value}</p>
      </div>
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-yellow-50 text-yellow-700">
        {icon}
      </div>
    </div>
  );
}

function RolePill({ role }: { role: DbRole }) {
  const styles: Record<DbRole, string> = {
    super_admin: "bg-yellow-100 text-yellow-700",
    doctor: "bg-yellow-100 text-yellow-700",
    secretary: "bg-yellow-100 text-yellow-700",
    staff: "bg-yellow-100 text-yellow-700",
    patient: "bg-yellow-100 text-yellow-700",
    admin: "bg-slate-200 text-slate-700",
  };
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${styles[role]}`}>
      {roleLabel(role)}
    </span>
  );
}

function Field({
  label,
  required = false,
  hint,
  hintTone = "muted",
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  hintTone?: "muted" | "success" | "error";
  children: React.ReactNode;
}) {
  const toneClass =
    hintTone === "success"
      ? "text-yellow-700"
      : hintTone === "error"
        ? "text-yellow-600"
        : "text-slate-500";
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-600">
        {label}
        {required ? <span className="ml-0.5 text-yellow-500">*</span> : null}
      </span>
      {children}
      {hint ? <p className={`mt-1 text-[10px] ${toneClass}`}>{hint}</p> : null}
    </label>
  );
}

/**
 * Shared modal frame — slim slate header, emerald or red accent strip,
 * rounded-xl card. Closes on Esc + on backdrop click. Replaces the older
 * gradient-headered modals so the whole module reads as one tool.
 */
function ModalShell({
  title,
  tone,
  onClose,
  maxWidth = "lg",
  children,
}: {
  title: string;
  tone: "emerald" | "red";
  onClose: () => void;
  maxWidth?: "md" | "lg" | "xl";
  children: React.ReactNode;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const accent = tone === "red" ? "bg-yellow-50 border-yellow-100" : "bg-yellow-50 border-yellow-100";
  const widthClass = maxWidth === "md" ? "max-w-md" : maxWidth === "xl" ? "max-w-2xl" : "max-w-lg";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4 backdrop-blur-sm"
      onClick={onClose}
      role="presentation"
    >
      <div
        className={`w-full ${widthClass} rounded-xl bg-white shadow-2xl`}
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`flex items-center justify-between border-b px-4 py-2.5 ${accent}`}>
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1 text-slate-500 hover:bg-white/60 hover:text-slate-800"
          >
            <FaXmark className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
        <div className="px-4 py-3">{children}</div>
      </div>
    </div>
  );
}


export type AdminRole = "owner" | "admin" | "moderator";

export type AdminStatus = "active" | "disabled" | "pending";

export type AdminMe = {
  id: number;
  email: string;
  role: AdminRole;
  status: AdminStatus | string;
  permissions: string[];
};

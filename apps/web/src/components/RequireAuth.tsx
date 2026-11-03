import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { getStoredUser } from "../lib/session";

type Props = {
  children: ReactNode;
  roles?: string[];
};

export function RequireAuth({ children, roles }: Props) {
  const location = useLocation();
  const user = getStoredUser();

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (roles && !roles.includes(user.role.code)) {
    if (user.role.code === "SUPER_ADMIN") {
      return <Navigate to="/admin" replace />;
    }
    return <Navigate to="/owner" replace />;
  }

  return children;
}

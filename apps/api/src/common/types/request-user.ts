import { Role } from "@prisma/client";

export type AuthenticatedUser = {
  userId: string;
  role: Role;
};

export type AuthedRequest = {
  user: AuthenticatedUser;
};

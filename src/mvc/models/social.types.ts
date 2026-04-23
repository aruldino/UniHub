/** Social hub domain shapes (MVC — Model). */

export type ProfileSnippet = {
  user_id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
};

export type GroupMemberWithProfile = Record<string, unknown> & {
  user_id: string;
  profiles?: ProfileSnippet | undefined;
};

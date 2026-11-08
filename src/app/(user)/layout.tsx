export const metadata = { robots: { index: false, follow: false } };

/** Account, vault and wallet are private: never indexed. */
export default function UserLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

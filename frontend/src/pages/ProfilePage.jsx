import PageHeader from "../components/ui/PageHeader";
import { useAuth } from "../features/auth/useAuth";

export default function ProfilePage() {
  const { user } = useAuth();

  return (
    <div className="content-stack">
      <PageHeader
        eyebrow="Profile"
        title="Your taste profile will grow with every saved bottle."
        description="This protected account surface is ready for preference and cellar insights."
      />

      <section className="tool-surface profile-summary">
        <span>Signed in as</span>
        <strong>{user?.name}</strong>
        <p>{user?.email}</p>
      </section>
    </div>
  );
}

import { ButtonLink } from "@/components/ui/Button";
import { PageShell } from "@/components/ui/PageShell";

export default function NotFoundPage() {
  return (
    <PageShell
      actions={
        <ButtonLink to="/" variant="primary">
          Return to the beginning
        </ButtonLink>
      }
      description="The address is not part of this cellar. No account or saved-wine data has been changed."
      eyebrow="404 / Not found"
      title="THIS PAGE IS NOT IN THE DIRECTORY"
    >
      <div />
    </PageShell>
  );
}

import ConfirmationPage from "@/components/confirmation-page";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ConfirmationPage id={id} />;
}

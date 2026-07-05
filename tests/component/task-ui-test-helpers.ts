import { screen, within } from "@testing-library/react";
import type { UserEvent } from "@testing-library/user-event";

export async function openProcessingDetailsFromAssistantMenu(user: UserEvent): Promise<void> {
  const assistants = screen.getAllByLabelText("Assistant response");
  const assistant = assistants[assistants.length - 1]!;
  await user.click(
    within(assistant).getByRole("button", { name: "More response actions" })
  );
  await user.click(screen.getByRole("menuitem", { name: "View processing details" }));
}

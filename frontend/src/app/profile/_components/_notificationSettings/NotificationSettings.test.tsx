import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Profile } from "@/lib/api";
import { NotificationSettings } from "./NotificationSettings";

const { apiMock } = vi.hoisted(() => ({
  apiMock: { getProfile: vi.fn(), updateReminderPreferences: vi.fn() },
}));

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return { ...actual, api: { ...actual.api, ...apiMock } };
});

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

import { toast } from "sonner";

const savedProfile = {
  userId: "user-1",
  firstName: "Jane",
  lastName: "Doe",
  username: "janedoe",
  email: "jane@example.com",
  province: null,
  tfsaBirthYear: null,
  tfsaRoomUsedElsewhere: null,
  rrspContributionRoom: null,
  monthlyTakeHomeIncome: null,
  payFrequency: null,
  nextPayday: null,
  primaryFinancialGoal: null,
  avatarColor: null,
  billRemindersEnabled: true,
  billReminderLeadDays: 3,
  budgetOverspendAlertsEnabled: true,
  lowBalanceAlertsEnabled: true,
  lowBalanceThreshold: 100,
  goalMilestoneAlertsEnabled: false,
  goalMilestonePercentages: [50, 100],
  subscriptionPriceAlertsEnabled: true,
  createdAt: "2026-04-04T00:00:00.000Z",
  updatedAt: "2026-04-04T00:00:00.000Z",
} satisfies Profile;

beforeEach(() => {
  vi.clearAllMocks();
  apiMock.getProfile.mockResolvedValue(savedProfile);
  apiMock.updateReminderPreferences.mockResolvedValue(savedProfile);
});

describe("NotificationSettings", () => {
  it("shows every alert kind with its saved state", async () => {
    render(<NotificationSettings />);

    const billToggle = await screen.findByRole("switch", { name: "Bill reminders" });
    expect(billToggle).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("switch", { name: "Savings goal milestones" })).toHaveAttribute(
      "aria-checked",
      "false"
    );
    expect(screen.getByRole("switch", { name: "Budget overspend" })).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "Low balance" })).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "Subscription price rises" })).toBeInTheDocument();
  });

  it("summarises how many alert kinds are on", async () => {
    render(<NotificationSettings />);

    expect(await screen.findByText(/4 of 5 alerts on/)).toBeInTheDocument();
  });

  it("saves a toggled alert kind and confirms with a toast", async () => {
    render(<NotificationSettings />);
    const budgetToggle = await screen.findByRole("switch", { name: "Budget overspend" });

    fireEvent.click(budgetToggle);

    await waitFor(() =>
      expect(apiMock.updateReminderPreferences).toHaveBeenCalledWith({
        budgetOverspendAlertsEnabled: false,
      })
    );
    expect(toast.success).toHaveBeenCalledWith("Notification settings saved");
  });

  it("rolls the toggle back and warns when the save fails", async () => {
    apiMock.updateReminderPreferences.mockRejectedValue(new Error("offline"));
    render(<NotificationSettings />);
    const subscriptionToggle = await screen.findByRole("switch", {
      name: "Subscription price rises",
    });

    fireEvent.click(subscriptionToggle);

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Couldn't save notification settings")
    );
    expect(subscriptionToggle).toHaveAttribute("aria-checked", "true");
  });

  it("saves a new bill reminder lead time", async () => {
    render(<NotificationSettings />);
    const leadDayOption = await screen.findByRole("button", { name: "7 days" });

    fireEvent.click(leadDayOption);

    await waitFor(() =>
      expect(apiMock.updateReminderPreferences).toHaveBeenCalledWith({ billReminderLeadDays: 7 })
    );
  });

  it("saves a milestone selection change", async () => {
    render(<NotificationSettings />);
    fireEvent.click(await screen.findByRole("switch", { name: "Savings goal milestones" }));
    await waitFor(() => expect(apiMock.updateReminderPreferences).toHaveBeenCalled());

    fireEvent.click(screen.getByRole("button", { name: "75%" }));

    await waitFor(() =>
      expect(apiMock.updateReminderPreferences).toHaveBeenCalledWith({
        goalMilestonePercentages: [50, 75, 100],
      })
    );
  });

  it("saves the low-balance threshold on blur", async () => {
    render(<NotificationSettings />);
    const thresholdInput = await screen.findByLabelText("Low balance threshold");

    fireEvent.change(thresholdInput, { target: { value: "300" } });
    fireEvent.blur(thresholdInput);

    await waitFor(() =>
      expect(apiMock.updateReminderPreferences).toHaveBeenCalledWith({ lowBalanceThreshold: 300 })
    );
  });

  it("restores the saved threshold instead of saving an unusable one", async () => {
    render(<NotificationSettings />);
    const thresholdInput = await screen.findByLabelText("Low balance threshold");

    fireEvent.change(thresholdInput, { target: { value: "-50" } });
    fireEvent.blur(thresholdInput);

    expect(thresholdInput).toHaveValue(100);
    expect(apiMock.updateReminderPreferences).not.toHaveBeenCalled();
  });
});

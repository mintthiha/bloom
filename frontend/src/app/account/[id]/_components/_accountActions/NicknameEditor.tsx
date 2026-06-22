"use client";
import { useState, useEffect } from "react";
import { api, Account } from "@/lib/api";
import { inputStyle } from "@/lib/styles/input";

type NicknameEditorProps = {
  accountId: string;
  nickname: string | null;
  onUpdated: (account: Account) => void;
  onError: (message: string) => void;
};

export function NicknameEditor({ accountId, nickname, onUpdated, onError }: NicknameEditorProps) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(nickname ?? "");
  const [saving, setSaving] = useState(false);

  /** Syncs the local input value when the nickname prop changes (e.g. after a parent refresh). */
  useEffect(() => {
    if (!editing) setValue(nickname ?? "");
  }, [nickname, editing]);

  /** Saves the updated nickname via the API and notifies the parent with the updated account. */
  async function handleSave() {
    setSaving(true);
    try {
      const updated = await api.updateNickname(accountId, value.trim() || undefined);
      onUpdated(updated);
      setEditing(false);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Failed to save nickname");
    } finally {
      setSaving(false);
    }
  }

  /** Cancels the edit and resets the input back to the last saved nickname. */
  function handleCancel() {
    setValue(nickname ?? "");
    setEditing(false);
  }

  return (
    <div
      className="fade-up fade-up-2"
      style={{
        background: "var(--surface-1)",
        border: "1px solid var(--border)",
        borderRadius: "16px",
        padding: "20px",
        marginBottom: "16px",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "16px",
          marginBottom: "12px",
        }}
      >
        <div>
          <p
            style={{
              fontSize: "11px",
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: "var(--text-secondary)",
              marginBottom: "6px",
            }}
          >
            Account Nickname
          </p>
          <p style={{ fontSize: "13px", color: "var(--text-muted)" }}>
            Use a short custom label to identify this account quickly.
          </p>
        </div>
        {!editing && (
          <button
            onClick={() => setEditing(true)}
            style={{
              padding: "8px 12px",
              border: "1px solid var(--border)",
              background: "transparent",
              color: "var(--text-primary)",
              borderRadius: "8px",
              fontSize: "12px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Edit
          </button>
        )}
      </div>

      {editing ? (
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <input
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Optional nickname"
            style={{ ...inputStyle, flex: "1 1 220px" }}
          />
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              padding: "10px 16px",
              background: "#f59e0b",
              color: "#000",
              fontWeight: 700,
              fontSize: "14px",
              border: "none",
              borderRadius: "8px",
              cursor: saving ? "not-allowed" : "pointer",
              opacity: saving ? 0.45 : 1,
            }}
          >
            {saving ? "Saving..." : "Save"}
          </button>
          <button
            onClick={handleCancel}
            disabled={saving}
            style={{
              padding: "10px 16px",
              border: "1px solid var(--border)",
              background: "transparent",
              color: "var(--text-secondary)",
              fontWeight: 600,
              fontSize: "14px",
              borderRadius: "8px",
              cursor: saving ? "not-allowed" : "pointer",
            }}
          >
            Cancel
          </button>
        </div>
      ) : (
        <p style={{ fontSize: "15px", fontWeight: 600 }}>{nickname ?? "No nickname set"}</p>
      )}
    </div>
  );
}

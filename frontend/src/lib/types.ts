export type FeedbackState = {
  error: string | null;
  success: string | null;
  setError: (msg: string | null) => void;
  setSuccess: (msg: string | null) => void;
};

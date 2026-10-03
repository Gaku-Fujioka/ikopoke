"use client";

type ScreenStateProps = {
  loading: boolean;
  error: string | null;
  onRetry: () => void;
};

export function ScreenState({ loading, error, onRetry }: ScreenStateProps) {
  if (loading) {
    return <p role="status" className="rounded-2xl bg-white p-6 text-stone-600">デモデータを読み込んでいます…</p>;
  }

  if (error) {
    return (
      <div role="alert" className="rounded-2xl border border-red-200 bg-white p-6">
        <h2 className="font-semibold text-stone-900">デモデータを表示できません</h2>
        <p className="mt-2 text-sm leading-6 text-stone-600">{error}</p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 min-h-11 rounded-full border border-stone-300 px-5 text-sm font-semibold text-stone-800 hover:bg-stone-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-700 focus-visible:ring-offset-2"
        >
          もう一度読み込む
        </button>
      </div>
    );
  }

  return null;
}

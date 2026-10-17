const fallback = "登録できませんでした。入力内容や通信状態をご確認のうえ、時間をおいて再度お試しください。";

/** Use stable provider codes, never provider text containing request or user data. */
export function signUpErrorMessage(error: unknown): string {
  if (!error || typeof error !== "object") return fallback;
  const code = "code" in error ? error.code : undefined;
  switch (code) {
    case "email_address_not_authorized":
      return "この開発環境では、このメールアドレスへ確認メールを送れません。管理者にメール送信設定の確認を依頼してください。";
    case "over_email_send_rate_limit":
      return "確認メールの送信回数が上限に達しています。時間をおいて再度お試しください。";
    case "over_request_rate_limit":
      return "操作回数が上限に達しています。少し時間をおいて再度お試しください。";
    case "weak_password":
      return "パスワードが登録条件を満たしていません。より長く、推測されにくいパスワードに変更してください。";
    case "email_address_invalid":
      return "このメールアドレスは登録に利用できません。入力内容と、利用可能なメールアドレスかをご確認ください。";
    case "signup_disabled":
    case "email_provider_disabled":
      return "現在、メールアドレスでの新規登録を受け付けていません。管理者にご確認ください。";
    case "request_timeout":
      return "登録処理が時間内に完了しませんでした。通信状態をご確認のうえ、時間をおいて再度お試しください。";
  }
  if ("name" in error && error.name === "AuthRetryableFetchError") {
    return "通信できませんでした。接続状態をご確認のうえ、時間をおいて再度お試しください。";
  }
  return fallback;
}

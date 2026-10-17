import assert from "node:assert/strict";
import test from "node:test";
import { signUpErrorMessage } from "../lib/auth/sign-up-error.ts";

test("blocked email recipients explain the delivery configuration rather than blaming input", () => {
  assert.match(signUpErrorMessage({code:"email_address_not_authorized"}),/確認メールを送れません/);
  assert.match(signUpErrorMessage({code:"email_address_not_authorized"}),/メール送信設定/);
});
test("mail and request limits give distinct retry guidance", () => {
  assert.match(signUpErrorMessage({code:"over_email_send_rate_limit"}),/確認メールの送信回数/);
  assert.match(signUpErrorMessage({code:"over_request_rate_limit"}),/操作回数/);
});
test("input and signup configuration failures identify an actionable cause", () => {
  assert.match(signUpErrorMessage({code:"weak_password"}),/パスワードが登録条件/);
  assert.match(signUpErrorMessage({code:"email_address_invalid"}),/登録に利用できません/);
  for(const code of ["signup_disabled","email_provider_disabled"])assert.match(signUpErrorMessage({code}),/新規登録を受け付けていません/);
});
test("network failures and timeouts are handled without exposing exception text", () => {
  assert.match(signUpErrorMessage(new TypeError("private-network-request")),/^登録できませんでした/);
  assert.match(signUpErrorMessage({name:"AuthRetryableFetchError",message:"private-network-request"}),/通信できません/);
  assert.match(signUpErrorMessage({code:"request_timeout"}),/時間内に完了しません/);
});
test("known and unknown provider failures never expose personal data or tokens", () => {
  const privateDetail="private-email private-password private-token";
  for(const code of ["email_address_not_authorized","over_email_send_rate_limit","weak_password","unknown", "__proto__", privateDetail]) {
    const result=signUpErrorMessage({code,message:privateDetail,email:privateDetail});
    assert.equal(typeof result,"string");assert.doesNotMatch(result,/private-email|private-password|private-token/);
  }
  for(const value of [null,undefined,"private-token",new Error(privateDetail),{}, {code:{message:privateDetail}}]) {
    assert.match(signUpErrorMessage(value),/^登録できませんでした/);
  }
});

import { useState, type FormEvent } from "react";
import type { AppSession, Role } from "../types";
import { BookIcon, SparkleIcon } from "./icons";

type LoginScreenProps = {
  onLogin: (session: AppSession) => void;
};

const roleOptions: Array<{ role: Role; title: string; description: string }> = [
  {
    role: "student",
    title: "Học sinh",
    description: "Xem học liệu đã xuất bản và hỏi AI Agent trợ lý học tập.",
  },
  {
    role: "admin",
    title: "Admin",
    description: "Tải lên và quản lý học liệu (PDF) theo từng buổi học.",
  },
];

export function LoginScreen({ onLogin }: LoginScreenProps) {
  const [role, setRole] = useState<Role>("student");
  const [name, setName] = useState("");

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) return;
    onLogin({ role, name: trimmedName });
  };

  return (
    <main className="login-screen">
      <section className="login-card" aria-labelledby="login-title">
        <div className="brand-mark" aria-hidden="true"><BookIcon /></div>
        <p className="eyebrow">VLEARN</p>
        <h1 id="login-title">Đăng nhập</h1>
        <p className="login-copy">Chọn vai trò của bạn để tiếp tục.</p>

        <form className="login-form" onSubmit={submit}>
          <div className="role-options" role="radiogroup" aria-label="Vai trò">
            {roleOptions.map((option) => (
              <button
                type="button"
                key={option.role}
                className={`role-card ${role === option.role ? "is-active" : ""}`}
                role="radio"
                aria-checked={role === option.role}
                onClick={() => setRole(option.role)}
              >
                <strong>{option.title}</strong>
                <span>{option.description}</span>
              </button>
            ))}
          </div>

          <label className="login-field">
            <span>Tên hiển thị</span>
            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Nhập tên của bạn"
              maxLength={60}
              required
            />
          </label>

          <button className="button button-primary login-submit" type="submit">
            <SparkleIcon />
            Vào VLearn
          </button>
        </form>
        <p className="login-note">Đăng nhập demo · không yêu cầu mật khẩu</p>
      </section>
    </main>
  );
}

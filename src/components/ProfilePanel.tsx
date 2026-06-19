import { useState } from 'react';

export function ProfilePanel() {
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const arrow = isFeedbackOpen ? '<' : '>';

  return (
    <nav className="profile-panel" aria-label="个人导航">
      <div>
        <p className="section-kicker">PROFILE</p>
        <h2>个人导航</h2>
      </div>
      <button
        className="feedback-entry"
        type="button"
        aria-label="问题反馈"
        aria-expanded={isFeedbackOpen}
        onClick={() => setIsFeedbackOpen((open) => !open)}
      >
        <span className="profile-ascii" aria-hidden="true">
{`+----------------------+
| 问题反馈          ${arrow} |
+----------------------+`}
        </span>
      </button>
      {isFeedbackOpen ? (
        <div className="feedback-detail" aria-label="问题反馈联系方式">
          <p className="feedback-account">微信公众号：陈化AI札记</p>
          <img className="feedback-qr" src="/feedback-qr.jpg" alt="陈化AI札记微信公众号二维码" />
        </div>
      ) : null}
    </nav>
  );
}

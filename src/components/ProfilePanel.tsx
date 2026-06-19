import { useState } from 'react';
import { ChevronDown, MessageCircle, QrCode } from 'lucide-react';

export function ProfilePanel() {
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);

  return (
    <nav className="profile-panel feedback-panel" aria-label="问题反馈">
      <div>
        <p className="section-kicker">FEEDBACK</p>
        <h2>问题反馈</h2>
      </div>
      <button
        className="feedback-entry"
        type="button"
        aria-label="问题反馈"
        aria-expanded={isFeedbackOpen}
        onClick={() => setIsFeedbackOpen((open) => !open)}
      >
        <span className="feedback-entry-main">
          <MessageCircle aria-hidden="true" size={18} />
          <span>问题反馈</span>
        </span>
        <ChevronDown aria-hidden="true" size={18} />
      </button>
      {isFeedbackOpen ? (
        <div className="feedback-detail" aria-label="问题反馈联系方式">
          <div className="feedback-copy">
            <QrCode aria-hidden="true" size={18} />
            <p className="feedback-account">微信公众号：陈化AI札记</p>
          </div>
          <img className="feedback-qr" src="/feedback-qr.jpg" alt="陈化AI札记微信公众号二维码" />
        </div>
      ) : null}
    </nav>
  );
}

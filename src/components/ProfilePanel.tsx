import { useState } from 'react';
import { ChevronDown, Copy, Github, MessageCircle, QrCode } from 'lucide-react';

const GITHUB_URL = 'https://github.com/huachen19867/jiujiu-personal-player';

export function ProfilePanel() {
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');

  const copyGitHubUrl = async () => {
    try {
      await navigator.clipboard.writeText(GITHUB_URL);
      setCopyState('copied');
    } catch {
      setCopyState('failed');
    }
  };

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
            <p className="feedback-account">
              <span>微信公众号是：</span>
              <strong>陈化AI札记</strong>
            </p>
          </div>
          <img className="feedback-qr" src="/feedback-qr.jpg" alt="陈化AI札记微信公众号二维码" />
          <div className="feedback-github">
            <Github aria-hidden="true" size={18} />
            <div className="feedback-github-copy">
              <span>GitHub链接</span>
              <a href={GITHUB_URL} target="_blank" rel="noreferrer">
                {GITHUB_URL}
              </a>
            </div>
            <button
              type="button"
              aria-label={`${copyState === 'copied' ? '已复制' : copyState === 'failed' ? '复制失败' : '复制'} GitHub 链接`}
              onClick={copyGitHubUrl}
            >
              <Copy aria-hidden="true" size={15} />
              <span>{copyState === 'copied' ? '已复制' : copyState === 'failed' ? '复制失败' : '复制'}</span>
            </button>
          </div>
        </div>
      ) : null}
    </nav>
  );
}

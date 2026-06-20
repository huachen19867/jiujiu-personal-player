import { useState } from 'react';
import { ChevronDown, Copy, Github, MessageCircle, QrCode, X } from 'lucide-react';

const GITHUB_URL = 'https://github.com/huachen19867/jiujiu-personal-player';
const PUBLIC_ACCOUNT = '陈化AI札记';

type CopyState = 'idle' | 'copied' | 'manual';

export function ProfilePanel() {
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const [isQrOpen, setIsQrOpen] = useState(false);
  const [accountCopyState, setAccountCopyState] = useState<CopyState>('idle');
  const [githubCopyState, setGithubCopyState] = useState<CopyState>('idle');

  const copyAccountName = async () => {
    setAccountCopyState((await copyText(PUBLIC_ACCOUNT)) ? 'copied' : 'manual');
  };

  const copyGitHubUrl = async () => {
    setGithubCopyState((await copyText(GITHUB_URL)) ? 'copied' : 'manual');
  };

  const accountCopyLabel = copyLabel(accountCopyState);
  const githubCopyLabel = copyLabel(githubCopyState);

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
              <strong>{PUBLIC_ACCOUNT}</strong>
            </p>
            <button
              type="button"
              className="feedback-copy-button"
              aria-label={`${accountCopyLabel}公众号名`}
              onClick={copyAccountName}
            >
              <Copy aria-hidden="true" size={14} />
              <span>{accountCopyLabel}</span>
            </button>
          </div>
          <button
            className="feedback-qr-button"
            type="button"
            aria-label="放大公众号二维码"
            onClick={() => setIsQrOpen(true)}
          >
            <img className="feedback-qr" src="/feedback-qr.jpg" alt="陈化AI札记微信公众号二维码" />
            <span>点开二维码</span>
          </button>
          <div className="feedback-github">
            <Github aria-hidden="true" size={18} />
            <div className="feedback-github-copy">
              <span>GitHub链接</span>
              <a href={GITHUB_URL} target="_blank" rel="noreferrer">
                {GITHUB_URL}
              </a>
              {githubCopyState === 'manual' ? (
                <small className="feedback-manual-copy">复制不成功时，长按链接手动复制。</small>
              ) : null}
            </div>
            <button type="button" aria-label={`${githubCopyLabel} GitHub 链接`} onClick={copyGitHubUrl}>
              <Copy aria-hidden="true" size={15} />
              <span>{githubCopyLabel}</span>
            </button>
          </div>
        </div>
      ) : null}
      {isQrOpen ? (
        <div className="feedback-qr-modal" role="dialog" aria-label="微信公众号二维码">
          <button type="button" aria-label="关闭二维码" onClick={() => setIsQrOpen(false)}>
            <X aria-hidden="true" size={18} />
          </button>
          <img src="/feedback-qr.jpg" alt="陈化AI札记微信公众号二维码" />
          <p>长按识别二维码</p>
        </div>
      ) : null}
    </nav>
  );
}

function copyLabel(state: CopyState) {
  if (state === 'copied') {
    return '已复制';
  }
  if (state === 'manual') {
    return '长按复制';
  }
  return '复制';
}

async function copyText(text: string) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fall back to a temporary text field below.
    }
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', 'true');
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  document.body.appendChild(textarea);
  textarea.select();

  try {
    return document.execCommand?.('copy') ?? false;
  } catch {
    return false;
  } finally {
    document.body.removeChild(textarea);
  }
}

export function ProfilePanel() {
  return (
    <nav className="profile-panel" aria-label="个人导航">
      <div>
        <p className="section-kicker">PROFILE</p>
        <h2>个人导航</h2>
      </div>
      <pre className="profile-ascii" aria-label="公众号导航示意">
{`+----------------------+
| ABOUT  MP  ARCHIVE   |
| 99 PLAYER / LOCAL    |
| WECHAT: TO-BE-FILLED |
+----------------------+`}
      </pre>
      <p>公众号：待填写</p>
    </nav>
  );
}

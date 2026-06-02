import './IcpFooter.css';

const ICP_NUMBER = '粤ICP备2025510744号-2';
const ICP_URL = 'https://beian.miit.gov.cn/';
const SITE_NAME = 'Vocabulary iknow';

interface IcpFooterProps {
  variant?: 'app' | 'login';
}

export default function IcpFooter({ variant = 'app' }: IcpFooterProps) {
  const year = new Date().getFullYear();

  return (
    <footer className={`site-footer site-footer--${variant}`}>
      <span className="site-footer__copy">
        © {year} {SITE_NAME}
      </span>
      <span className="site-footer__sep" aria-hidden="true">
        ·
      </span>
      <a
        className="site-footer__icp"
        href={ICP_URL}
        target="_blank"
        rel="noopener noreferrer"
      >
        {ICP_NUMBER}
      </a>
    </footer>
  );
}

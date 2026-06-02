interface AppLogoProps {
  className?: string;
}

export default function AppLogo({ className }: AppLogoProps) {
  return (
    <img
      src="/logo.png"
      alt="Vocabulary iknow"
      className={className}
      width={32}
      height={32}
      decoding="async"
    />
  );
}

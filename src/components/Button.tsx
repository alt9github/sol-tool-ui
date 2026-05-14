import type { ButtonHTMLAttributes, ReactNode } from 'react';

export type ButtonVariant = 'default' | 'primary' | 'text';
export type ButtonSize = 'md' | 'sm';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: ReactNode;
}

/**
 * Plain button with variant/size tokens. Host controls colors via the
 * `--sol-ui-*` CSS variables (see styles/tokens.css).
 */
export function Button({
  variant = 'default',
  size = 'md',
  className,
  children,
  type = 'button',
  ...rest
}: ButtonProps) {
  const cls = [
    'sol-ui-btn',
    variant !== 'default' && `sol-ui-btn--${variant}`,
    size !== 'md' && `sol-ui-btn--${size}`,
    className,
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <button type={type} className={cls} {...rest}>
      {children}
    </button>
  );
}

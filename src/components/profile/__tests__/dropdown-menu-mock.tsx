import * as React from 'react';

/**
 * O DropdownMenu do Radix trava o jsdom ao abrir (ver docs/redesign/room-kit.md). Nos testes ele vira um menu
 * simples com os mesmos papéis (menu/menuitem) e o contrato do `onSelect` (preventDefault mantém aberto).
 */
const Ctx = React.createContext<{ open: boolean; setOpen: (v: boolean) => void }>({ open: false, setOpen: () => {} });

export function DropdownMenu({ children }: { children?: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  return <Ctx.Provider value={{ open, setOpen }}>{children}</Ctx.Provider>;
}

export function DropdownMenuTrigger({ children }: { children: React.ReactElement<{ onClick?: () => void; onKeyDown?: (e: React.KeyboardEvent) => void }> }) {
  const { open, setOpen } = React.useContext(Ctx);
  return React.cloneElement(children, {
    onClick: () => setOpen(!open),
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') setOpen(true);
    },
  } as object);
}

export function DropdownMenuContent({ children, ...rest }: { children?: React.ReactNode; 'aria-label'?: string }) {
  const { open } = React.useContext(Ctx);
  return open ? (
    <div role="menu" aria-label={rest['aria-label']}>
      {children}
    </div>
  ) : null;
}

export function DropdownMenuItem({
  children,
  onSelect,
  ...rest
}: {
  children?: React.ReactNode;
  onSelect?: (e: { preventDefault: () => void }) => void;
  'aria-disabled'?: string;
  className?: string;
}) {
  const { setOpen } = React.useContext(Ctx);
  return (
    <div
      role="menuitem"
      tabIndex={-1}
      aria-disabled={rest['aria-disabled']}
      onClick={() => {
        let prevented = false;
        onSelect?.({ preventDefault: () => (prevented = true) });
        if (!prevented) setOpen(false);
      }}
    >
      {children}
    </div>
  );
}

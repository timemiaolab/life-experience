import { useEffect, useState } from 'react';

export function Toast({ msg }: { msg: { text: string; t: number } | null }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (!msg) return;
    setShow(true);
    const h = setTimeout(() => setShow(false), 2600);
    return () => clearTimeout(h);
  }, [msg]);
  return <div className={`toast${show ? ' show' : ''}`} role="status">› {msg?.text}</div>;
}

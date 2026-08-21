import { createContext, useCallback, useContext, useRef, useState } from 'react';

const ToastContext = createContext(() => {});
export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const id = useRef(0);

  const toast = useCallback((msg, icon = '✦') => {
    const key = ++id.current;
    setItems(list => [...list, { key, msg, icon }]);
    setTimeout(() => setItems(list => list.filter(t => t.key !== key)), 3600);
  }, []);

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="toasts" aria-live="polite">
        {items.map(t => (
          <div className="toast" key={t.key}>
            <b>{t.icon}</b><span dangerouslySetInnerHTML={{ __html: t.msg }} />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

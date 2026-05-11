'use client';

import { Dispatch, SetStateAction, useEffect, useState } from 'react';

export function useAutoDismissedState<T>(
  initialValue: T,
  delayMs = 3000
): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState(initialValue);

  useEffect(() => {
    if (!value) return;

    const timeoutId = window.setTimeout(() => setValue(initialValue), delayMs);

    return () => window.clearTimeout(timeoutId);
  }, [delayMs, initialValue, value]);

  return [value, setValue];
}

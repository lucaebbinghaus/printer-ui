"use client";

import React, { useRef } from "react";
import { useKeyboard } from "@/app/components/KeyboardProvider";

type Props = React.InputHTMLAttributes<HTMLInputElement> & {
  value: string;
  onValueChange: (v: string) => void;
};

export default function KeyboardInput({ value, onValueChange, ...rest }: Props) {
  const { openFor } = useKeyboard();
  const inputRef = useRef<HTMLInputElement | null>(null);

  return (
    <input
      ref={inputRef}
      {...rest}
      value={value}
      onChange={(e) => onValueChange(e.target.value)}
      onFocus={() =>
        openFor({
          getValue: () => value,
          setValue: onValueChange,
          ref: inputRef,
        })
      }
      inputMode="none"
    />
  );
}

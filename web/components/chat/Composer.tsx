"use client";
/**
 * Message box with a send button and one-tap "quick lines" (the
 * storyline sentences), so a demo video never depends on typing.
 */
import { useState } from "react";

type Props = {
   onSend: (text: string) => void;
   disabled: boolean;
   placeholder: string;
   quickLines: string[];
};

/** Renders quick-line chips above an input row. */
export function Composer(
   { onSend, disabled, placeholder, quickLines }: Props,
) {
   const [text, setText] = useState("");

   /** Sends the typed text and clears the box. */
   const submit = (e: React.FormEvent) => {
      e.preventDefault();
      if (!text.trim()) return;
      onSend(text);
      setText("");
   };

   return (
      <div className="composer">
         <div className="composer__quick">
            {quickLines.map((q) => (
               <button key={q} type="button" className="chip"
                  disabled={disabled} onClick={() => onSend(q)}>
                  {q}
               </button>
            ))}
         </div>
         <form className="composer__row" onSubmit={submit}>
            <input value={text} onChange={(e) => setText(e.target.value)}
               placeholder={placeholder} aria-label={placeholder}
               disabled={disabled} />
            <button className="composer__send" type="submit"
               disabled={disabled || !text.trim()} aria-label="Send">
               &#10148;
            </button>
         </form>
      </div>
   );
}

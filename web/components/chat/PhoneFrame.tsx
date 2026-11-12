/**
 * Phone shell for the buyer chat: bezel, notch, and a header with
 * the buyer's name, country (as a postage stamp) and a generic
 * channel tag (DM / Email / Chat). Deliberately not any real app.
 */
import type { ReactNode } from "react";
import { PostageStamp } from "@/components/common/PostageStamp";
import { CHANNEL_LABEL } from "@/lib/constants";
import { countryName } from "@/lib/format";
import type { Channel } from "@/lib/types";

type Props = {
   name: string;
   country?: string;
   channel: Channel;
   children: ReactNode;
};

/** Draws the device and puts `children` inside the screen. */
export function PhoneFrame({ name, country, channel, children }: Props) {
   return (
      <div className="phone">
         <div className="phone__notch" aria-hidden="true" />
         <div className="phone__screen">
            <header className="phone__bar">
               <PostageStamp code={country} tone="gold" />
               <span className="phone__who">
                  <strong>{name}</strong>
                  <small>{countryName(country)}</small>
               </span>
               <span className="phone__channel">
                  {CHANNEL_LABEL[channel]}
               </span>
            </header>
            <div className="phone__airmail" aria-hidden="true" />
            {children}
         </div>
      </div>
   );
}

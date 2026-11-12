/**
 * "Who it is for" artwork, built from plain HTML and CSS: a kraft
 * parcel tied with twine, an airmail-striped address label, a row
 * of postage stamps and a customs sticker. It says "export" without
 * a single logo or brand name.
 */
import { PostageStamp } from "@/components/common/PostageStamp";
import { SELLER_CITY, SELLER_NAME } from "@/lib/constants";

/** Renders the parcel; decorative, hidden from screen readers. */
export function ParcelArt() {
   return (
      <div className="parcel" aria-hidden="true">
         <div className="parcel__box">
            <div className="parcel__twine parcel__twine--h" />
            <div className="parcel__twine parcel__twine--v" />
            <div className="parcel__stamps">
               <PostageStamp code="GB" value="£" tone="red" size="lg" />
               <PostageStamp code="US" value="$" tone="indigo" size="lg" />
               <PostageStamp code="DE" value="€" tone="gold" size="lg" />
            </div>
            <div className="parcel__label">
               <div className="parcel__strip" />
               <p className="parcel__small">FROM</p>
               <p className="parcel__big">{SELLER_NAME}</p>
               <p className="parcel__small">
                  {SELLER_CITY}, Rajasthan, India
               </p>
               <p className="parcel__small parcel__small--to">TO</p>
               <p className="parcel__big">Emma, London</p>
               <p className="parcel__small">United Kingdom</p>
            </div>
            <div className="parcel__fragile">HANDLE WITH CARE</div>
            <div className="parcel__customs">
               <b>CUSTOMS</b>
               <span>Handmade textiles</span>
            </div>
         </div>
      </div>
   );
}

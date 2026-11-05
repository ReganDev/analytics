/** The GraySite wordmark (warm-grey G and S, as on graysite.uk) plus the product name. */
export default function Brand() {
  return (
    <>
      <span className="brand__word" aria-label="GraySite">
        <span className="brand__accent">G</span>ray<span className="brand__accent">S</span>ite
      </span>
      <span className="brand__product">Portal</span>
    </>
  )
}

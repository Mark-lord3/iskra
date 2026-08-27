/**
 * Every image on the site goes through here so they all get the same
 * grayscale + ember duotone grade and read as one shoot.
 *
 * PLACEHOLDER SOURCE: Lorem Picsum, seeded so each slot is stable between
 * loads. Swap `src` for real ISKRA photography before launch; the grade in
 * .photo will keep new images consistent with the rest of the page.
 */
export default function Photo({ src, seed, plate, w = 1200, h = 800, alt = '', className = '', hover = false, children }) {
  const imageSeed = seed ?? plate ?? 'iskra-photo';

  return (
    <div className={`photo${hover ? ' photo-hover' : ''} ${className}`}>
      <img src={src || `https://picsum.photos/seed/${imageSeed}/${w}/${h}?grayscale`}
           alt={alt} loading="lazy" decoding="async" width={w} height={h} />
      {children}
    </div>
  );
}

const PHOTO_OVERRIDES = {
  'yuliana-rivera-fararoni': { objectPosition: '60% 15%', transform: 'scale(2.15)', transformOrigin: '60% 15%' },
}

function normalizeName(name = '') {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
}

export function getAdvisorPhoto(name = '') {
  const slug = normalizeName(name)
  return `/avatars/${slug}.png`
}

export default function AdvisorAvatar({ name, initials, className = '', style }) {
  const slug    = normalizeName(name)
  const src     = `/avatars/${slug}.png`
  const overrides = PHOTO_OVERRIDES[slug] || {}

  return (
    <div
      className={className}
      style={{ ...style, position: 'relative', flex: '0 0 auto', overflow: 'hidden' }}
      aria-label={name}
    >
      <img
        src={src}
        alt={name}
        onError={e => {
          e.currentTarget.style.display = 'none'
          const fb = e.currentTarget.nextElementSibling
          if (fb) fb.style.display = 'flex'
        }}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          display: 'block',
          objectFit: 'cover',
          objectPosition: overrides.objectPosition || '50% 18%',
          transform: overrides.transform || 'none',
          transformOrigin: overrides.transformOrigin || '50% 50%',
        }}
      />
      <span
        style={{
          display: 'none',
          position: 'absolute',
          inset: 0,
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
          height: '100%',
        }}
      >
        {initials}
      </span>
    </div>
  )
}

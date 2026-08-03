const PROFILE_PHOTOS = {
  'andrea paredes': '/avatars/andrea-paredes.png',
  'andrea valdez': '/avatars/andrea-valdez.png',
  'gabriel eduardo sotelo fonseca': '/avatars/gabriel-fonseca.png',
  'jesus maltos': '/avatars/jesus-maltos.png',
  'jose francisco zepeda gallegos': '/avatars/francisco-zepeda.png',
  'francisco zepeda': '/avatars/francisco-zepeda.png',
  'megan flores': '/avatars/megan-flores.png',
  'monica velazquez': '/avatars/monica-velazquez.png',
  'omar diaz': '/avatars/omar-diaz.png',
  'yuliana rivera fararoni': '/avatars/Yuliana-fararoni.png',
}

function normalizeName(name = '') {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
}

export function getAdvisorPhoto(name = '') {
  return PROFILE_PHOTOS[normalizeName(name)] || null
}

export default function AdvisorAvatar({ name, initials, className = '', style }) {
  const photo = getAdvisorPhoto(name)
  const isYuliana = normalizeName(name) === 'yuliana rivera fararoni'

  return (
    <div
      className={className}
      style={{
        ...style,
        position: 'relative',
        flex: '0 0 auto',
        overflow: 'hidden',
      }}
      aria-label={name}
    >
      {photo ? (
        <img
          src={photo}
          alt={name}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            maxWidth: '100%',
            maxHeight: '100%',
            display: 'block',
            objectFit: 'cover',
            objectPosition: isYuliana ? '60% 15%' : '50% 18%',
            transform: isYuliana ? 'scale(2.15)' : 'none',
            transformOrigin: isYuliana ? '60% 15%' : '50% 50%',
          }}
        />
      ) : initials}
    </div>
  )
}

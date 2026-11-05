import styled, { keyframes } from 'styled-components';
import { AWS_UPLOADS } from './Includes';

export interface PartnerLogo {
  src: string;
  alt: string;
  /** the partner's website — the logo links there when set */
  href?: string;
}

// Admin → Partners manages the logos. No placeholder brands: when the list
// can't be loaded, the partner strip is simply hidden.
export const DEFAULT_LOGOS: PartnerLogo[] = [];

/** A saved partner logo as an image URL: an upload key (served from /uploads/)
    or a site path such as /clients/… */
export const logoUrl = (logo: string) =>
  !logo ? '' : /^(https?:)?\/\//.test(logo) || logo.startsWith('/') ? logo : AWS_UPLOADS + logo;

interface TrustedByProps {
  trustedBy?: string;
  industryLeaders?: string;
  logos?: PartnerLogo[];
}

const Logo = ({ logo }: { logo: PartnerLogo }) =>
  logo.href ? (
    <LogoCard as="a" href={logo.href} target="_blank" rel="noopener noreferrer" title={logo.alt}>
      <img src={logo.src} alt={logo.alt} loading="lazy" />
    </LogoCard>
  ) : (
    <LogoCard>
      <img src={logo.src} alt={logo.alt} loading="lazy" />
    </LogoCard>
  );

export default function TrustedBy({
  trustedBy = "Trusted by",
  industryLeaders = "25,000+ world-class brands",
  logos = DEFAULT_LOGOS,
}: TrustedByProps) {
  if (!logos.length) return null;
  // Repeat the logos so one group is always wider than the viewport
  const times = Math.max(2, Math.ceil(24 / logos.length));
  const extendedLogos = Array.from({ length: times }, () => logos).flat();
  return (
    <Wrapper id="clients" className="py-3">
      <div className="section-header" data-aos="fade-up" data-aos-delay="100">
        <h2 className="text-center">
          {trustedBy}<span className="txtcgyellow">{industryLeaders}</span>
        </h2>
        <Divider />
      </div>
      <Marquee>
        <Track>
          {/* Two identical groups — animation translates exactly -50% (one group width) */}
          <Group>
            {extendedLogos.map((logo, i) => (
              <Logo key={i} logo={logo} />
            ))}
          </Group>
          <Group aria-hidden="true">
            {extendedLogos.map((logo, i) => (
              <Logo key={i + extendedLogos.length} logo={logo} />
            ))}
          </Group>
        </Track>
      </Marquee>
    </Wrapper>
  );
}

const scroll = keyframes`
  0%   { transform: translateX(0); }
  100% { transform: translateX(-50%); }
`;

const Wrapper = styled.section`
  overflow: hidden;
`;

const Divider = styled.div`
  width: 48px;
  height: 3px;
  background: #1F5FAF;
  margin: 10px auto 32px;
  border-radius: 2px;
`;

const Marquee = styled.div`
  overflow: hidden;
  width: 100%;
  -webkit-mask-image: linear-gradient(
    to right,
    transparent 0%,
    black 8%,
    black 92%,
    transparent 100%
  );
  mask-image: linear-gradient(
    to right,
    transparent 0%,
    black 8%,
    black 92%,
    transparent 100%
  );
`;

const Track = styled.div`
  display: flex;
  width: max-content;
  animation: ${scroll} 45s linear infinite;
`;

const Group = styled.div`
  display: flex;
  align-items: center;
`;

const LogoCard = styled.div`
  margin: 0 14px;
  padding: 14px 24px;
  border: 1px solid #e8e8e8;
  border-radius: 12px;
  background: #ffffff;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  display: flex;
  align-items: center;
  justify-content: center;
  height: 80px;
  min-width: 180px;
  flex-shrink: 0;
  text-decoration: none;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;

  &[href]:hover {
    border-color: #1F5FAF;
    box-shadow: 0 4px 14px rgba(31, 95, 175, 0.18);
  }

  img {
    max-height: 50px;
    max-width: 160px;
    width: auto;
    object-fit: contain;
  }
`;

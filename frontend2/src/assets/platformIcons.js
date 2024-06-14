import YouTube from '@mui/icons-material/YouTube';
import Facebook from '@mui/icons-material/Facebook';
import Twitter from '@mui/icons-material/Twitter';
import Instagram from '@mui/icons-material/Instagram';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';

export const YouTubeIcon = <YouTube htmlColor="#c4302b" />;
export const FacebookIcon = <Facebook htmlColor="#4267B2" />;
export const TwitterIcon = <Twitter htmlColor="#1DA1F2" />;
export const InstagramIcon = <Instagram htmlColor="#833AB4" />;

export const getIconForLink = (link) => {
  if (
    link.toLowerCase().includes('youtube.com') ||
    link.toLowerCase().includes('youtu.be')
  ) {
    return YouTubeIcon;
  }
  if (
    link.toLowerCase().includes('facebook.com') ||
    link.toLowerCase().includes('fb.com')
  ) {
    return FacebookIcon;
  }
  if (link.toLowerCase().includes('instagram.com')) {
    return InstagramIcon;
  }
  if (
    link.toLowerCase().includes('twitter.com') ||
    link.toLowerCase().includes('t.co')
  ) {
    return TwitterIcon;
  }
  return <AccountCircleIcon />;
};

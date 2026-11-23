import HomeIcon from '@mui/icons-material/Home';
import SearchIcon from '@mui/icons-material/Search';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import PersonIcon from '@mui/icons-material/Person';
import FavoriteIcon from '@mui/icons-material/Favorite';
import NotificationsIcon from '@mui/icons-material/Notifications';
import AppsIcon from '@mui/icons-material/Apps';
import MenuIcon from '@mui/icons-material/Menu';
import InfoIcon from '@mui/icons-material/Info';
import ChatIcon from '@mui/icons-material/Chat';
import StarIcon from '@mui/icons-material/Star';
import ListIcon from '@mui/icons-material/List';
import PlaceIcon from '@mui/icons-material/Place';
import PhoneIcon from '@mui/icons-material/Phone';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import QrCodeIcon from '@mui/icons-material/QrCode';
import ShareIcon from '@mui/icons-material/Share';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';

// Sama dengan ikon vektor di template Android (ic_nav_*)
const fs = { fontSize: 20 };
export const NAV_ICON_EL = {
  home: <HomeIcon sx={fs} />, search: <SearchIcon sx={fs} />, cart: <ShoppingCartIcon sx={fs} />, user: <PersonIcon sx={fs} />,
  heart: <FavoriteIcon sx={fs} />, bell: <NotificationsIcon sx={fs} />, apps: <AppsIcon sx={fs} />, menu: <MenuIcon sx={fs} />,
  info: <InfoIcon sx={fs} />, chat: <ChatIcon sx={fs} />, star: <StarIcon sx={fs} />, list: <ListIcon sx={fs} />,
  place: <PlaceIcon sx={fs} />, phone: <PhoneIcon sx={fs} />, play: <PlayArrowIcon sx={fs} />, qr: <QrCodeIcon sx={fs} />,
  share: <ShareIcon sx={fs} />, up: <ArrowUpwardIcon sx={fs} />
};
export const NAV_ICONS = Object.keys(NAV_ICON_EL);

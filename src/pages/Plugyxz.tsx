import { OwnerProfilePage } from "@/components/site/OwnerProfilePage";
import plugyxzIcon from "@/assets/plugyxz-icon.png";

const Plugyxz = () => (
  <OwnerProfilePage
    ownerKey="plugyxz"
    adminEmail="monb11190@gmail.com"
    name="plugyxz"
    role="Director & Lead Developer"
    imageSrc={plugyxzIcon}
    accent="gold"
    about={
      <p>
        Hi, I'm a Roblox Developer and Lead working behind multiple projects and communities
        across the platform. What started as a way to make money on Roblox quickly turned into
        something much bigger, managing teams, building games, and meeting a lot of new people
        along the way. Over time I've taken on a leadership role across development teams such
        as Oversite, handling everything from planning and game design to coordinating large
        scale development teams. My main focus is keeping Oversite and Oversite partnered
        groups running smoothly while improving quality and consistency. What began as small
        commissions has grown into more organized, large-scale development work, and I'm
        continuing to expand with every new project I take on.
      </p>
    }
  />
);

export default Plugyxz;

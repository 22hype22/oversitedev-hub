import { OwnerProfilePage } from "@/components/site/OwnerProfilePage";
import plugyxzIcon from "@/assets/plugyxz-icon.png";

const Plugyxz = () => (
  <OwnerProfilePage
    ownerKey="plugyxz"
    adminEmail="monb11190@gmail.com"
    name="plugyxz"
    role="Director & Lead Developer"
    imageSrc={plugyxzIcon}
    about={
      <p>
        Bio coming soon — plugyxz serves as Director and Lead Developer at Oversite,
        helping build and direct the projects that power our community.
      </p>
    }
  />
);

export default Plugyxz;

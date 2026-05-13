import { OwnerProfilePage } from "@/components/site/OwnerProfilePage";

const MeetTheOwner = () => (
  <OwnerProfilePage
    ownerKey="owner"
    adminEmail="everant00@gmail.com"
    name="22HYPE22"
    role="Founder of Oversite"
    imageSrc="/favicon.png"
    about={
      <>
        <p>
          Hi, I'm the founder and Lead Developer behind Oversite, Oversite Marketplace,
          Priority One, SkyHarvest, and Colorado State Roleplay. What began as a way to earn
          money through Roblox development quickly became something much greater — a genuine
          connection to a community I care deeply about.
        </p>
        <p>
          What started as a single idea has grown into a platform serving hundreds of
          thousands of users across thousands of servers. Every project I've built has been
          driven by one goal: giving back to the community that supported me from the start.
        </p>
        <p>
          Oversite was originally created as a central home for all of my projects. One by
          one the vision expanded — Priority One, Oversite Marketplace, and more — each one
          building on the last. Today, Oversite oversees 100+ staff members and a growing
          community of {"{member count}"} members across all platforms. Together with my
          team, we've built something far beyond what I ever imagined, and we're just getting
          started.
        </p>
      </>
    }
  />
);

export default MeetTheOwner;

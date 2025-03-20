import DEX from "@/home/page";
import { getSiteName } from "@/lib/chain";

export const metadata = {
  title: `${getSiteName()}`,
};

export default function Home() {
  return <DEX />;
}

import Trade from "@/create/page";
import { getSiteName } from "@/lib/chain";

export const metadata = {
  title: `${getSiteName()}`,
};

export default function Home() {
  return <Trade />;
}

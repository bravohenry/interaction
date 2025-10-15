import { HomeGreeting } from "~/components/home/home-greeting";
import { HomeHeader } from "~/components/home/home-header";
import { TextPokeButton } from "~/components/home/text-poke-button";

export function HomeScreen() {
  return (
    <div className="flex h-full flex-col">
      <HomeHeader />

      <div className="flex flex-1 flex-col px-6">
        <HomeGreeting />
        <TextPokeButton />
      </div>
    </div>
  );
}

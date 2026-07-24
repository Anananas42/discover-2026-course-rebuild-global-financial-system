// The second half of the bridge out of the mission briefing: initializing
// the financial system also unlocks deploying, so the card announcing the
// initialize button is followed by one announcing the deploy button it
// reveals. Same card shell; no action, because the button it describes
// does not exist yet — and the card leaves with its sibling on initialize.
export function DeployExplainer() {
  return (
    <div className="rounded-lg border border-line px-5 py-4">
      <h4 className="mb-2 text-[15px] font-semibold">Deploy system updates</h4>
      <div className="space-y-2.5 text-[15px] leading-relaxed">
        <p>
          Initializing also adds a second button beside "Run tests": "Deploy
          updates".
        </p>
        <p>
          Deploying ships your implementation into the real world: the course
          server runs it against scenarios stricter than your local tests, and
          the outcome appears on the classroom board.
        </p>
      </div>
    </div>
  );
}

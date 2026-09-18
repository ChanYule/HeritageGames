type Props = {
  title: string;
  objective: string;
  steps: string[];
  tip?: string;
};

export default function InstructionSteps({ title, objective, steps, tip }: Props) {
  return (
    <div className="instruction-card">
      <div className="instruction-heading">
        <p className="eyebrow">How to play</p>
        <h2>{title}</h2>
        <p>{objective}</p>
      </div>
      <ol className="instruction-list">
        {steps.map((step, index) => (
          <li key={step}>
            <span>{index + 1}</span>
            <p>{step}</p>
          </li>
        ))}
      </ol>
      {tip && <p className="instruction-tip"><strong>Tip:</strong> {tip}</p>}
    </div>
  );
}

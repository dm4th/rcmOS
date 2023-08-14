export function FileProcessing({ progressTitle, progressValues }) {
    // Component to render the progress of the claim processing with multiple stages
    // progressTitle: string
    // progressValues: array of progress values for each stage
    // each progress value has a text and progress value
    return (
        <div className="flex flex-col justify-between m-2 ">
            <div className="flex flex-col items-center justify-center my-2">
                <h3 className="text-xl text-gray-900 dark:text-white p-2">{progressTitle}</h3>
                {progressValues.map((stage, index) => (
                    <div key={`stage-${index}`} className="flex flex-col w-3/4 items-center justify-center mt-4">
                    <progress className={`progress-bar`} value={stage.progress} max={100} />
                        <p className="text-gray-600 dark:text-gray-400 text-xs italic mt-2">{stage.text} {stage.progress > 0 ? ` - ${stage.progress}%` : ''}</p>
                    </div>
                ))}
            </div>
        </div>
    );
}

export function ClaimProcessing({ progressText, progress }) {
    return (
        <div className="flex flex-col justify-between m-2 ">
            <div className="flex flex-col items-center justify-center my-2">
                <progress className={`progress-bar`} value={progress} max={100} />
                <p className="text-gray-600 dark:text-gray-400 text-xs italic">{progressText}</p>
            </div>
        </div>
    );
}

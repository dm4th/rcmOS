export function Processing({ uploadStageAWS, uploadStageSupabase }) {
    return (
        <div className="flex justify-center mt-6">
            <div className="flex flex-col items-center justify-center w-1/2">
                {uploadStageAWS.filter((stage) => stage.active === true).map((stage) => (
                    <div key={stage.stage} className="flex flex-col items-center justify-center my-2">
                        <h3 className="text-2xl text-gray-900 dark:text-white">
                            {stage.stage}
                        </h3>
                        <progress className={`progress-bar`} value={stage.progress} max={stage.max} />
                    </div>
                ))}
            </div>
            <div className="border-l-2 border-gray-300 mx-4"></div>
            <div className="flex flex-col items-center justify-center w-1/2">
                {uploadStageSupabase.filter((stage) => stage.active === true).map((stage) => (
                    <div key={stage.stage} className="flex flex-col items-center justify-center my-2">
                        <h3 className="text-2xl text-gray-900 dark:text-white p-1">
                            {stage.stage}
                        </h3>
                        <progress className={`progress-bar`} value={stage.progress} max={stage.max} />
                    </div>
                ))}
            </div>
        </div>
    );
}

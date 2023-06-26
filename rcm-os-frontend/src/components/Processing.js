export function Processing({ uploadStageAWS, uploadStageSupabase }) {
    const totalStages = uploadStageAWS.length + uploadStageSupabase.length;
    const totalProgress = uploadStageAWS.reduce((acc, stage) => acc + stage.progress, 0) + uploadStageSupabase.reduce((acc, stage) => acc + stage.progress, 0);
    const averageProgress = totalProgress / totalStages;

    return (
        <div className="flex flex-col items-center justify-center mt-6">
            <div className="w-full p-4">
                <h1 className="p-4 text-4xl text-gray-900 dark:text-white">
                    Total Progress
                </h1>
                <progress className={`progress-bar`} value={averageProgress} max={100} />
            </div>
            <div className="flex justify-center mt-6 w-full">
                <div className="flex flex-col items-center justify-center w-1/2">
                    {uploadStageAWS.filter((stage) => stage.active === true).map((stage) => (
                        <div key={stage.stage} className="flex flex-col items-center justify-center my-2">
                            <h3 className="text-2xl text-gray-900 dark:text-white p-2">
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
                            <h3 className="text-2xl text-gray-900 dark:text-white p-2">
                                {stage.stage}
                            </h3>
                            <progress className={`progress-bar`} value={stage.progress} max={stage.max} />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
